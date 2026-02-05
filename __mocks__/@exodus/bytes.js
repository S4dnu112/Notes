// Mock for @exodus/bytes ESM module
module.exports = {
    encode: (str) => Buffer.from(str, 'utf-8'),
    decode: (buf) => buf.toString('utf-8')
};
