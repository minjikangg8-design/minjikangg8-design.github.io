# 돈셈랩 (DonsemLab) — 급여·4대보험·세금 계산기 사이트

정적 사이트입니다. 빌드 단계가 없고, HTML/CSS/JS 파일을 그대로 올리면 동작합니다.
(HTML5 + CSS3 + vanilla ES6, 외부 라이브러리·CDN·폰트 요청 없음)

## 폴더 구조

```
tax-calc-site/
├── index.html            허브 + 메인 연봉 실수령액 계산기(히어로 바로 아래에서 즉시 동작)
├── salary.html           연봉 실수령액 · 4대보험 계산기 (연봉 구간표 포함)
├── insurance.html        4대보험 상세(근로자·사업주) + 시급·주휴수당·월급 환산
├── severance.html        퇴직금 · 실업급여 계산기
├── freelancer.html       프리랜서 3.3% · 종합소득세 계산기
├── yearend.html          연말정산 신용카드 소득공제 계산기
├── about.html            사이트 소개 (운영 목적·계산 기준·면책)
├── privacy.html          개인정보처리방침 (Google AdSense 쿠키 고지 포함)
├── terms.html            이용약관
├── contact.html          문의하기
├── 404.html              오류 페이지
├── sitemap.xml           사이트맵 (10개 URL)
├── robots.txt            크롤러 정책
└── assets/
    ├── css/style.css     공통 디자인 시스템
    └── js/
        ├── site.js       공통 UI(모바일 메뉴, 탭, 콤마 입력)
        └── calc.js       2026년 요율 상수 + 계산 엔진 + 화면 초기화
```

## 적용된 값 (확정)

| 항목 | 값 | 위치 |
| --- | --- | --- |
| 사이트 주소 | `https://minjikangg8-design.github.io` | 모든 HTML의 canonical·og:url, `sitemap.xml`, `robots.txt` |
| 문의 메일 | `0manzu0@naver.com` | `privacy.html`, `terms.html`, `contact.html` |
| 브랜드명 | `돈셈랩` / `DonsemLab` | 모든 HTML |

나중에 개인 도메인을 붙이면 아래처럼 일괄 치환합니다.

```bash
cd tax-calc-site
grep -rl 'minjikangg8-design.github.io' . | xargs sed -i 's|https://minjikangg8-design.github.io|https://YOURDOMAIN.com|g'
```

## 로컬에서 확인하기

```bash
cd tax-calc-site
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

`index.html`을 파일로 직접 열어도 계산은 동작하지만, 상대 경로 확인은 서버로 여는 편이 정확합니다.

## 배포

### GitHub Pages (무료, 가장 간단)

1. 새 저장소를 만들고 이 폴더의 파일을 그대로 올립니다 (`index.html`이 루트에 와야 함).
2. Settings → Pages → Source를 `Deploy from a branch`, 브랜치 `main` / 폴더 `/ (root)`로 지정합니다.
3. 1~2분 뒤 `https://아이디.github.io/저장소명/`에서 열립니다.
4. 개인 도메인을 붙이려면 Settings → Pages → Custom domain에 도메인을 입력하고, 도메인 업체에서 CNAME(또는 A 레코드)을 설정합니다. 루트 도메인 배포 시 저장소에 `CNAME` 파일을 추가합니다.
5. 저장소명이 `아이디.github.io`가 아니라면 하위 경로로 서비스되므로, canonical과 sitemap의 URL을 실제 주소로 맞춰야 합니다.

### Cloudflare Pages / Vercel

- 프레임워크 프리셋을 `None`(또는 `Static`)으로 두고, 빌드 명령 없이 출력 디렉터리를 이 폴더로 지정하면 됩니다.
- 404 페이지는 자동으로 `404.html`을 사용합니다.

## 애드센스 신청 전 체크리스트

- [ ] 도메인 연결 후 `https://`(SSL)로 접속되는지 확인
- [ ] 위 표의 플레이스홀더를 모두 실제 값으로 치환
- [ ] `sitemap.xml`의 URL이 실제 도메인과 일치하는지 확인
- [ ] Google Search Console에 사이트 등록 → sitemap 제출
- [ ] 각 계산기 페이지에 실제로 방문해 계산이 동작하는지 확인
- [ ] 개인정보처리방침·이용약관·문의 페이지가 헤더/푸터에서 접근되는지 확인
- [ ] 애드센스 승인 후 `ads.txt` 추가 (Google이 제공하는 내용 그대로)
- [ ] 애드센스 스크립트 삽입 위치: 각 페이지 `</head>` 직전 (승인 후)

## 요율이 바뀔 때 수정할 곳

요율·상한·하한은 대부분 `assets/js/calc.js`의 `DS.RATES` 상수에 모여 있습니다.

| 항목 | 수정 위치 | 갱신 시점 |
| --- | --- | --- |
| 국민연금 4.75%, 건강보험 3.595%, 장기요양 0.9448%, 고용보험 0.9% | `calc.js`의 `DS.RATES` | 매년 1월 |
| 국민연금 기준소득월액 41만~659만 원 | `calc.js`의 `pensionMinBase` / `pensionMaxBase` | 매년 7월 |
| 실업급여 상한 68,100원·하한 기준 최저임금 10,320원 | `calc.js`의 `jobSeekCap` / `minimumWageHourly` | 매년 1월 (최저임금 고시 후) |
| 소득세율·근로소득공제·기본공제 | `DS.TAX_BRACKETS`, `workIncomeDeduction`, `basicDeduction` | 세법 개정 시 |
| 카드공제 한도·공제율 | `DS.cardDeduction` | 세법 개정 시 |
| 화면에 보이는 요율표·설명 문구 | 각 HTML의 `<div class="prose">` 및 요율 표 | 상수 변경과 동시에 |

계산식을 바꾸면 `scripts/verify_taxcalc_site.py`의 기대값도 함께 갱신해야 합니다.

## 검증

```bash
cd /workspace
python3 scripts/verify_taxcalc_site.py
```

검사 항목:

1. 내부 링크 404 여부
2. 각 페이지의 title·description·canonical·viewport·h1 개수
3. 중복 id, `aria-controls`/`aria-labelledby` 대상 존재
4. 모든 페이지의 헤더·푸터·신뢰 페이지 링크
5. 계산기별 실무 가이드 분량(한글 음절 1,200자 이상)
6. JS가 참조하는 element id가 해당 페이지에 존재하는지
7. HTML 태그 구조(열고 닫힘) 검사
8. 계산 엔진 19개 시나리오 대조 + 퇴직금 예시 + 1년 미만 퇴직금 미발생
9. `sitemap.xml` URL과 실제 파일 일치

계산 엔진 실행 검증에는 `quickjs` 파이썬 패키지를 사용합니다(`pip install quickjs`). 없으면 해당 항목만 건너뜁니다.
