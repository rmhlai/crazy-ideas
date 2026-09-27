declare module "heic-convert" {
  function convert(opts: {
    buffer: Buffer | ArrayBuffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  }): Promise<ArrayBuffer | Buffer>;
  export default convert;
}
