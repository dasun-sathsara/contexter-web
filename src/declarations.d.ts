declare module '*.wasm' {
    const src: string;
    export default src;
}

declare module '*.wasm?url' {
    const src: string;
    export default src;
} 
