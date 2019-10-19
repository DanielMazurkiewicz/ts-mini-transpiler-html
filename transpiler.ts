import { Parser } from 'htmlparser2';


interface IAstElement {
    tag: string,
    attributes: Record<string, string>,
    children: IAstElement[],
    value?: string,
}

interface IAst {
    astRoot: IAstElement

    styles: Record<string, boolean>
    elements: Record<string, boolean> 
}

const parse = (htmlText: string): IAst => {
    const astRoot: IAstElement = {tag: '*root*', children: [], attributes: {}};
    const astPath: IAstElement[] = [];
    let astCurrent: IAstElement = astRoot;

    const styles: Record<string, boolean> = {};
    const elements: Record<string, boolean> = {cpt: true, shadow: true};

    
    const parser = new Parser(
        {
            onopentag(name, attribs) {
                name = name.toLowerCase();
                elements[name] = true;
                if (attribs && attribs.class) {
                    attribs.class.split(' ').filter(c => c).forEach(c => styles[c] = true)
                }
                astPath.push(astCurrent);
                const astNew: IAstElement = {
                    tag: name,
                    attributes: attribs,
                    children: []
                }
                astCurrent.children.push(astNew);
                astCurrent = astNew;
            },

            ontext(text) {
                if (text.trim()) {
                    const astNew: IAstElement = {
                        tag: 'text',
                        attributes: {},
                        children: [],
                        value: text
                    }
                    astCurrent.children.push(astNew);    
                }
            },
            onclosetag() {
                astCurrent = <IAstElement>astPath.pop();
            }
        },
        { decodeEntities: true }
    );
    parser.write(
        htmlText
    );
    parser.end();

    return {
        astRoot,
        styles,
        elements,
    }
}

const fromLowerCase = (text: string): string => text[0].toLocaleLowerCase() + text.substr(1);
interface IComponentWrapperOptions {
    name?: string
    styleLibrary?: string
}
const componentWrapper = (styles: string, elements: string, content: string, options: IComponentWrapperOptions = {}): string => {
    const name = options.name || 'YourComponentName';
    const styleLibrary = options.styleLibrary || 'YourStyleLibrary'
return `
import { ${elements} } from "ts-mini/dom"
import { globalStyles } from "ts-mini/tss"
import { ${ styles } }
    from "${ styleLibrary }"

class ${name} extends HTMLElement {
    constructor() {
        super();

        shadow(this, globalStyles(),
${content}
        );
    }
}
export const ${fromLowerCase(name)} = cpt<${name}>(${name});
`;
}

const getTsName = (name: string): string => name.replace(/\-/g, '_');
const prepareImportNames = (obj: Record<string, boolean>): string => Object.keys(obj).map(getTsName).join(', ')
const getIdent = (ident: number) => ''.padStart(ident);
const getString = (text: string) => {
     let str = JSON.stringify(text);
    str = str.substr(1, str.length - 2)
        .replace(/\\\"/g, '"')
        .replace(/\`/g, '\\`')
        .replace(/\$/g, '\\$')
    return '`' + str + '`';
}
const getAttributeName = (name: string) => name.indexOf('-') >= 0 ? JSON.stringify(name) : name;
const getAttributes = (attributes: Record<string, string>): string => {
    if (!attributes || Object.keys(attributes).length === 0) return '';
    let results: string[] = [];
    for (let name in attributes) {
        const value = attributes[name];
        if (name.startsWith('on')) {

        } else if (name === 'class') {
            results.push('c: [' + value.split(' ').filter(c => c).map(getTsName).join(', ') + ']')
        } else {
            results.push(getAttributeName(name) + ': ' + getString(value));
        }
    }
    return `{${results.join(', ')}}`
}

const compile = (ast: IAst, options?: IComponentWrapperOptions): string => {
    let ident = 12;
    const recurent = (element: IAstElement): string => {
        if (element.tag === '*root*') {
            return element.children.map(recurent).join(',\n')
        } else if (element.tag === 'text') {
            return `${getIdent(ident)}${getString(<string>element.value)}` // TODO: convert to proper string        
        } else {
            ident += 4;
            const children = element.children.map(recurent).join(',\n')
            ident -= 4;

            let attributes = getAttributes(element.attributes);
            if (children) {
                if (attributes) attributes += ',';
                return `${getIdent(ident)}${element.tag}(${attributes}\n${children}\n${getIdent(ident)})`
            } else {
                return `${getIdent(ident)}${element.tag}(${attributes})`
            }
        }
    }

    return componentWrapper(prepareImportNames(ast.styles), prepareImportNames(ast.elements), recurent(ast.astRoot), options);
}


export const transpileHtml = (input: string, options?: IComponentWrapperOptions): string => {
    let result = '';
    const ast = parse(input);
    const compiled = compile(ast, options);
    result += compiled;
    // result += '\n==============================================\n';
    // result += JSON.stringify(ast, null, 3);
    // result += '\n==============================================\n';

    return result;
}

export const transpile = transpileHtml;