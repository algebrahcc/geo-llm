/**
 * RSA 公钥加密工具（零依赖，匹配后端 hutool RSA/ECB/PKCS1Padding 解密）
 *
 * 后端配置：continew-starter.encrypt.field.public-key
 */
const RSA_PUBLIC_KEY =
  'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAM51dgYtMyF+tTQt80sfFOpSV27a7t9uaUVeFrdGiVxscuizE7H8SMntYqfn9lp8a5GH5P1/GGehVjUD2gF/4kcCAwEAAQ==';

interface TLV {
  tag: number;
  length: number;
  value: Uint8Array;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function readTLV(bytes: Uint8Array, offset: number): { tlv: TLV; next: number } {
  const tag = bytes[offset];
  let len = bytes[offset + 1];
  let pos = offset + 2;
  if (len & 0x80) {
    const numBytes = len & 0x7f;
    len = 0;
    for (let i = 0; i < numBytes; i++) {
      len = (len << 8) | bytes[pos];
      pos++;
    }
  }
  const value = bytes.slice(pos, pos + len);
  return { tlv: { tag, length: len, value }, next: pos + len };
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const b of bytes) {
    result = (result << 8n) | BigInt(b);
  }
  return result;
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  while (hex.length < length * 2) hex = '0' + hex;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

/** 解析 X.509 SubjectPublicKeyInfo，提取 n / e */
function parsePublicKey(der: Uint8Array): { n: bigint; e: bigint } {
  const outer = readTLV(der, 0);
  const inner = outer.tlv.value;
  const alg = readTLV(inner, 0);
  const bitString = readTLV(inner, alg.next);
  const rsaKeyDer = bitString.tlv.value.slice(1); // 去掉 BIT STRING 首字节（未使用位数）
  const rsaKey = readTLV(rsaKeyDer, 0).tlv.value;
  const rm = readTLV(rsaKey, 0);
  const re = readTLV(rsaKey, rm.next);
  return {
    n: bytesToBigInt(rm.tlv.value),
    e: bytesToBigInt(re.tlv.value)
  };
}

/**
 * 使用 RSA 公钥加密明文（PKCS#1 v1.5 填充），返回 Base64
 *
 * @param plainText 待加密明文（如密码）
 * @param publicKey Base64 编码的 X.509 公钥，默认使用配置文件中的公钥
 */
export function encryptByRsaPublicKey(plainText: string, publicKey: string = RSA_PUBLIC_KEY): string {
  const { n, e } = parsePublicKey(base64ToBytes(publicKey));
  const k = Math.ceil(n.toString(2).length / 8);
  const message = new TextEncoder().encode(plainText);

  const psLen = k - 3 - message.length;
  if (psLen < 8) {
    throw new Error('明文过长，无法使用 RSA 加密');
  }

  const rand = new Uint8Array(psLen);
  crypto.getRandomValues(rand);
  const ps = new Uint8Array(psLen);
  for (let i = 0; i < psLen; i++) {
    // PKCS#1 要求填充字节非零
    ps[i] = rand[i] === 0 ? 1 : rand[i];
  }

  const em = new Uint8Array(k);
  em[0] = 0x00;
  em[1] = 0x02;
  em.set(ps, 2);
  em[2 + psLen] = 0x00;
  em.set(message, 3 + psLen);

  const m = bytesToBigInt(em);
  const c = modPow(m, e, n);

  return bytesToBase64(bigIntToBytes(c, k));
}
