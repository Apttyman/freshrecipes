// Global module declaration for importing .txt files as string content.
declare module '*.txt' {
  const content: string;
  export default content;
}
