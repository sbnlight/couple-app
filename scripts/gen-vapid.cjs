// 生成 Web Push 所需的 VAPID 密钥对 + Webhook 校验密钥
// 用法:node scripts/gen-vapid.cjs
// 公钥放前端环境变量;私钥与 Webhook 密钥只放 Supabase Edge Function Secrets,绝不入库
const { generateKeyPairSync, randomBytes } = require('node:crypto')

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
// VAPID 公钥 = P-256 公钥点的 65 字节未压缩编码,base64url
const der = publicKey.export({ format: 'der', type: 'spki' })
const pub = Buffer.from(der.subarray(der.length - 65)).toString('base64url')
// VAPID 私钥 = JWK 里的 d(本身就是 base64url)
const d = privateKey.export({ format: 'jwk' }).d

console.log('VAPID_PUBLIC_KEY=' + pub)
console.log('VAPID_PRIVATE_KEY=' + d)
console.log('PUSH_WEBHOOK_SECRET=' + randomBytes(16).toString('hex'))
