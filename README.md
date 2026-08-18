# 🌐 (주)에코플러스 경영컨설팅 스토어

> 정찰제·숨은비용 0원의 신뢰받는 중소기업 컨설팅 사이트
> 1차 진단 무료 → 본 컨설팅 토스 안전결제 모델

> **v13 (2026-08-18) — PG 심사 대응 문구 정비판입니다.**
> 정책자금·창업·연구소·벤처 4개 상세페이지의 결과 보장성 표현을 정비하고,
> 이용약관(`terms.html`)·개인정보처리방침(`privacy.html`)을 신규 추가했습니다.
> 변경 내역과 배포 전 확인사항은 **[PG심사_대응_변경요약_v13.md](PG심사_대응_변경요약_v13.md)** 를 먼저 보세요.

> **v12부터 배포 방식이 바뀌었습니다.**
> 무료진단은 [ecofree.cloud](https://ecofree.cloud/) 자가진단으로 연결되고,
> 배포는 드래그앤드롭이 아니라 **GitHub 커밋 → Netlify 자동배포**입니다.
> 설치·설정 절차는 **[배포_가이드_v12.html](배포_가이드_v12.html)** 을 브라우저로 열어 보세요.
> (체크리스트 저장·코드 복사·인쇄 기능 포함 / 텍스트판: [배포_가이드_v12.md](배포_가이드_v12.md))
> (아래 "Netlify 배포 절차"는 v11까지의 옛 방식입니다)

---

## 📂 파일 구조

```
ecoplus_store_final/
├── index.html                      ⭐ 메인 홈페이지
├── terms.html                      ⚖️ 이용약관 (v13 신규)
├── privacy.html                    🔒 개인정보처리방침 (v13 신규)
├── ecoplus_policy_fund.html        정책자금 상세
├── ecoplus_startup_fund.html       창업지원금 상세
├── ecoplus_rnd_center.html         기업부설연구소 상세
├── ecoplus_venture_cert.html       벤처기업인증 상세
├── success.html                    결제 성공 페이지
├── fail.html                       결제 실패 페이지
├── TGK01.jpg                       컨설턴트 프로필 사진
├── thumb_policy.png                상품 썸네일 4종
├── thumb_startup.png
├── thumb_rnd.png
├── thumb_venture.png
├── netlify.toml                    Netlify 설정
└── netlify/
    └── functions/
        └── confirm-payment.js      결제 승인 서버리스 함수
```

---

## 🚀 Netlify 배포 절차

### 1. 드래그&드롭 배포
1. https://app.netlify.com 접속
2. **"Sites" → "Add new site" → "Deploy manually"**
3. `ecoplus_store_final` 폴더 통째로 드래그
4. 30초 후 임시 URL 발급 (예: `eco-toss01.netlify.app`)

### 2. 사이트 이름 변경 (선택)
- Site configuration → Change site name → `ecoplus-consulting` 등으로 변경

### 3. 도메인 연결 (선택)
- 가비아·후이즈에서 도메인 구매 (예: `ecoplus.co.kr`)
- Netlify → Domain settings → Add custom domain

---

## 🔑 토스페이먼츠 가맹 신청 → 키 교체

### 가맹 신청
1. https://www.tosspayments.com 가맹점 신청
2. (주)에코플러스 사업자등록증·통신판매업 신고증 제출
3. 서비스 URL 입력란에 Netlify URL 입력
4. 심사 통과 (1~3 영업일)

### 클라이언트 키 교체 (코드 수정)
**파일:** `index.html` (약 590번째 줄)
```javascript
// 수정 전 (테스트 키)
const TOSS_CLIENT_KEY = 'test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

// 수정 후 (운영 키)
const TOSS_CLIENT_KEY = 'live_ck_여기에본인키입력';
```

### 시크릿 키 등록 (환경변수)
**Netlify 대시보드 설정:**
1. Site configuration → Environment variables → Add a variable
2. Key: `TOSS_SECRET_KEY`
3. Value: `live_sk_여기에본인시크릿키입력`
4. Save → 자동 재배포

> ⚠️ **시크릿 키는 절대 코드에 직접 작성하지 마세요!** 환경변수로만 관리해야 합니다.

---

## 💬 카카오톡 채널 연결

### 카톡 채널 만들기
1. https://center-pf.kakao.com 접속 → 카카오 비즈 계정 가입
2. 채널 만들기 → (주)에코플러스 정보 입력
3. 채널 URL 확인 (예: `https://pf.kakao.com/_ABCDE/chat`)

### URL 교체 (코드 수정)
**파일:** `index.html` (약 610번째 줄)
```javascript
const KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_xxxxxxx/chat'; // ← 교체
```

---

## 📧 Netlify Forms (무료 진단 신청 자동 수집)

### 자동 활성화
이미 코드에 설정 완료. Netlify에 배포하면 자동으로 작동합니다.

### 신청 데이터 확인
1. Netlify 대시보드 → Forms 메뉴
2. `diagnosis` 폼 클릭
3. 모든 신청 내역 확인 가능

### 이메일 알림 설정
1. Forms → diagnosis → Settings & usage
2. **Form notifications → Add notification**
3. **Email notification** 선택
4. 사장님 이메일 입력 → Save
5. 이제 신청 들어올 때마다 이메일 자동 발송!

### Slack 알림 (선택)
- 같은 메뉴에서 Slack 워크스페이스 연동 가능
- 실시간 카톡 같은 속도로 알림 받음

---

## 🎯 SEO 최적화 후속 작업

### Google Search Console 등록
1. https://search.google.com/search-console 접속
2. 도메인 입력 → 소유권 확인 (HTML 태그 방식 추천)
3. sitemap.xml 제출 (필요 시 별도 생성)

### 네이버 서치어드바이저
1. https://searchadvisor.naver.com 접속
2. 사이트 등록 → 소유권 확인
3. 사이트맵 제출

### 카톡 공유 시 썸네일 확인
- 카카오톡 디버거: https://developers.kakao.com/tool/clear/og
- URL 입력 후 캐시 초기화 → 미리보기 확인

---

## ✅ 운영 전 최종 체크리스트

- [ ] Netlify 배포 완료, URL 확인
- [ ] 사업자등록번호·통신판매업신고번호 입력 (index.html 푸터)
- [ ] 연락처 (전화번호·이메일) 입력 (푸터 + success.html)
- [ ] 카카오톡 채널 URL 교체 (index.html)
- [ ] 토스페이먼츠 가맹 신청 완료
- [ ] 토스 클라이언트 키 교체 (index.html)
- [ ] 토스 시크릿 키 환경변수 등록 (Netlify)
- [ ] Netlify Forms 이메일 알림 설정
- [ ] 모바일에서 전체 흐름 테스트 (썸네일·상세보기·구매·진단신청·카톡상담)
- [ ] 도메인 연결 (선택)

---

## 📞 문의

- 작성자: Claude (Anthropic)
- 문의: (주)에코플러스 경영지도사 그룹

---

**🎉 화이팅하세요!** 컨설팅 실적 5건 빠르게 달성하시길 응원합니다.
