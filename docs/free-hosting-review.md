# 무료 배포 환경 검토

> 2026-09-20 배포 완료: 기존 Cloudflare Free 계정에 `jihan-games` Worker와 `jihan-games-scores` D1을 만들었습니다. 공개 주소는 https://jihan-games.kaidu1982.workers.dev 입니다. 아래는 배포 전 비교 검토이며, 최종 구성·검증·운영 방법은 [README](../README.md)를 참고합니다.

검토일: 2026-09-20. 대상은 현재 지한이 무한계단, 이름 기반 게스트 세션, 서버의 캐릭터별 최고 점수 상위 100위 저장이다. 기간 한정 체험 크레딧보다 지속되는 무료 요금제를 우선했다. 이 문서는 검토 결과이며 배포 환경이나 게임 코드를 변경하지 않았다.

## 추천: Cloudflare Workers Free + Static Assets + D1 Free

게임 파일은 Static Assets, 점수 검증 API는 Worker, 상위 100위는 D1에 배치한다. 한 계정과 같은 출처에서 게임·API를 제공할 수 있어 쿠키를 유지하기 쉽다. Cloudflare는 카드 없이 무료로 시작할 수 있다고 안내한다. 별도 도메인을 구입하지 않고 기본 workers.dev 주소를 사용할 수 있다.

- [Workers 제품 안내](https://www.cloudflare.com/products/workers/)
- [workers.dev 주소](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

| 항목 | 무료 한도와 성격 |
| --- | --- |
| 정적 게임 파일 요청 | 무료·요청 수 무제한. Worker를 거치지 않는 정적 파일 제공 기준 |
| 서버 API | 계정 기준 하루 100,000회 |
| 요청당 서버 CPU | 10ms. 네트워크 대기나 게임 플레이 시간과는 다른 서버 계산 시간 |
| D1 읽기 | 계정 기준 하루 5,000,000행 |
| D1 쓰기 | 계정 기준 하루 100,000행. 삽입·수정·삭제 및 인덱스 작업을 고려해야 함 |
| D1 저장 공간 | 무료 DB 하나당 500MB, 계정 전체 5GB |

출처: [정적 파일 과금](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/), [D1 요금](https://developers.cloudflare.com/d1/platform/pricing/), [D1 한도](https://developers.cloudflare.com/d1/platform/limits/).

Free 요금제를 유지하면 초과 사용을 유료로 자동 정산하는 방식 대신 한도에 도달한 API/DB 기능이 오류를 반환한다. 정적 파일과 `/api/*` 라우팅을 분리하면 서버 한도를 사용했을 때에도 정적 게임 파일을 제공할 수 있다. 현재 게임에는 서버 연결 실패 시 기기 내 최고 기록으로 계속하는 처리가 있다. 유료 요금제로 전환하거나 다른 유료 서비스를 추가하면 별도 과금 체계가 적용된다.

하루 1,000명이 각 10판을 하고, 접속 시 순위 조회 1회 + 한 판당 시작·제출·순위 조회 3회라고 가정하면 약 31,000 API 요청이다. 이는 현재 호출 흐름에 따른 요청 수 예시이며 방문자 수 보장이나 부하 테스트 결과는 아니다. 추가 순위 조회, 실패 재시도, 봇, 같은 계정의 다른 게임도 한도를 사용한다.

게임당 100개 기록의 데이터 용량은 작다. 무료 운영 여부는 저장 용량보다 API 호출 수, DB가 실제로 읽고 쓰는 행 수, 최대 길이 경기의 점수 검증 CPU에 좌우된다. 게임 애니메이션과 조작은 방문자의 기기에서 처리된다.

## 대안 비교

| 환경 | 판단 |
| --- | --- |
| Vercel Hobby + Supabase Free | 무료 조합 가능. 개인·비상업용 Hobby 조건에 맞춰 운영해야 하며, 두 서비스의 한도를 관리한다. Supabase는 최근 7일 사용량이 적으면 프로젝트가 일시 중지될 수 있어 간헐적으로 이용하는 가족 게임에 불편할 수 있다. |
| 현재 Firebase Hosting + Functions + Firestore | 코드 변경이 가장 적다. 실제 사용료가 무료 제공량 안에 들 수 있지만 Functions 배포에는 Blaze와 결제 계정이 필요하다. 결제 연결 없는 운영 목적에는 우선순위가 낮다. |
| GitHub Pages 단독 | 정적 게임 파일 공개에는 사용할 수 있지만 현재 점수 검증 서버와 공용 순위표 DB를 제공하지 않는다. 다른 백엔드가 필요하다. |
| Render Free | Node 서버 이전은 비교적 쉽다. 다만 15분 유휴 후 중지, 재개 시 약 1분 대기, 무료 서버의 영속 디스크 미지원, 무료 Postgres의 30일 만료 때문에 장기 무료 공개용으로는 추천하지 않는다. |

출처: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase Free 요금](https://supabase.com/pricing), [Supabase 일시 중지](https://supabase.com/docs/guides/platform/free-project-pausing), [Firebase Functions 배포 조건](https://firebase.google.com/docs/functions/get-started), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Render Free](https://render.com/docs/free).

## 현재 코드에서 필요한 전환

1. `functions/src/index.ts`의 Firebase 진입점을 Worker 진입점으로 바꾼다. 점수 재계산 규칙, 게스트 서명과 소유권 검증은 재사용한다.
2. Firestore 저장소를 D1 저장소로 교체한다. 단순히 읽은 후 덮어쓰는 방식은 동시 제출을 잃을 수 있다. 현재 구조를 살리려면 게임별 한 행에 상위 100위 JSON과 revision을 저장하고, revision 조건부 갱신과 충돌 재시도를 적용한다. 또는 순위별 행에 조건부 갱신·100위 밖 삭제를 하나의 SQL batch 트랜잭션으로 처리한다.
3. `dist/` 정적 파일과 `/api/*` 요청을 같은 주소로 연결한다. 정적 파일까지 매번 Worker를 실행하지 않도록 설정한다.
4. D1 바인딩과 운영용 세션 서명 비밀값을 등록하고 배포 설정을 추가한다.
5. 실제 Workers 환경에서 최대 5,000계단 기록 검증이 무료 CPU 한도에 들어오는지, 동시 제출이 상위 100위를 유지하는지, 쿠키와 삭제가 정상 동작하는지 확인한다.

최신 Workers는 Express 서버 연결을 위한 호환 기능을 제공하므로 HTTP API 전체를 처음부터 다시 작성할 필요는 없다. 다만 파일 기반 저장소와 Firebase 관리자 SDK를 그대로 배포하는 구성은 사용하지 않는다. API 실행 환경·저장소·배포 설정 변경이 핵심이다.

전환 참고: [Express 배포](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/), [Node 호환](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [crypto 호환](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/), [D1 batch 트랜잭션](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), [정적 파일과 Worker 라우팅](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

배포에 필요한 사용자 측 준비는 Cloudflare 계정과 배포 권한 연결이다. 게임 이용자는 계속 캐릭터 이름만 입력한다. 서비스 정책과 무료 한도는 이후 바뀔 수 있으므로 실제 배포 시 다시 확인한다.
