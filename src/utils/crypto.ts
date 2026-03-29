/**
 * Web Crypto API 实现的 AES-128-ECB 加解密
 * 适配 ClawBot 媒体文件加解密需求
 */

/**
 * 生成随机 AES-128 密钥
 */
export async function generateAesKey(): Promise<Uint8Array> {
  const key = await crypto.getRandomValues(new Uint8Array(16));
  return key;
}

/**
 * 将 Uint8Array 转换为 CryptoKey
 */
async function importAesKey(keyData: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CBC' }, // 使用 CBC 模式模拟 ECB
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * PKCS7 填充
 */
function pkcs7Pad(data: Uint8Array): Uint8Array {
  const blockSize = 16;
  const padding = blockSize - (data.length % blockSize);
  const padded = new Uint8Array(data.length + padding);
  padded.set(data);
  padded.fill(padding, data.length);
  return padded;
}

/**
 * PKCS7 去除填充
 */
function pkcs7Unpad(data: Uint8Array): Uint8Array {
  const padding = data[data.length - 1];
  return data.slice(0, data.length - padding);
}

/**
 * AES-128-ECB 加密
 * 使用 CBC 模式配合空 IV 模拟 ECB
 */
export async function aes128EcbEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  // 填充
  const padded = pkcs7Pad(plaintext);
  
  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );
  
  // 使用空 IV 模拟 ECB
  const iv = new Uint8Array(16);
  
  // 分块加密 (模拟 ECB)
  const blockSize = 16;
  const numBlocks = padded.length / blockSize;
  const encrypted = new Uint8Array(padded.length);
  
  for (let i = 0; i < numBlocks; i++) {
    const block = padded.slice(i * blockSize, (i + 1) * blockSize);
    const encryptedBlock = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      block
    );
    encrypted.set(new Uint8Array(encryptedBlock).slice(0, blockSize), i * blockSize);
  }
  
  return encrypted;
}

/**
 * AES-128-ECB 解密
 * 使用 CBC 模式配合空 IV 模拟 ECB
 */
export async function aes128EcbDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  // 使用空 IV 模拟 ECB
  const iv = new Uint8Array(16);
  
  // 分块解密
  const blockSize = 16;
  const numBlocks = Math.ceil(ciphertext.length / blockSize);
  const decrypted = new Uint8Array(numBlocks * blockSize);
  
  for (let i = 0; i < numBlocks; i++) {
    const block = ciphertext.slice(i * blockSize, (i + 1) * blockSize);
    // 补齐块
    const paddedBlock = new Uint8Array(blockSize);
    paddedBlock.set(block);
    
    const decryptedBlock = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      paddedBlock
    );
    decrypted.set(new Uint8Array(decryptedBlock), i * blockSize);
  }
  
  // 去除填充
  return pkcs7Unpad(decrypted.slice(0, ciphertext.length));
}

/**
 * 计算 MD5
 */
export async function md5(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('MD5', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Base64 编码
 */
export function base64Encode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

/**
 * Base64 解码
 */
export function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hex 字符串转 Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Uint8Array 转 Hex 字符串
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
