const argon2 = require('@node-rs/argon2');

async function test() {
  console.log('argon2 모듈 로드 성공');
  
  // hash 테스트
  const hash = await argon2.hash('testpassword', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
  console.log('hash 결과 (앞 30자):', hash.substring(0, 30));
  
  // verify 테스트
  const valid = await argon2.verify(hash, 'testpassword');
  console.log('verify 결과:', valid);
  
  const invalid = await argon2.verify(hash, 'wrongpassword');
  console.log('잘못된 비밀번호 verify 결과:', invalid);
}

test().catch(err => console.error('테스트 실패:', err));
