// ════════════════════════════════════════════════════════════
// 토스페이먼츠 결제 승인 Function
//
// 이 함수는 결제 성공 후 토스 서버에 최종 승인 요청을 보냅니다.
// 클라이언트에서 직접 시크릿 키를 사용하면 보안에 위험하므로
// 서버 측에서 처리하는 것이 필수입니다.
//
// 환경변수 설정 (Netlify 대시보드에서):
//   TOSS_SECRET_KEY = test_sk_... (테스트) 또는 live_sk_... (운영)
// ════════════════════════════════════════════════════════════

exports.handler = async (event, context) => {
  // CORS 헤더 (preflight 대응)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 요청 본문 파싱
    const { paymentKey, orderId, amount } = JSON.parse(event.body);

    // 필수값 검증
    if (!paymentKey || !orderId || !amount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '필수 결제 정보가 누락되었습니다' })
      };
    }

    // 시크릿 키 (환경변수에서 로드 - 절대 코드에 직접 작성 금지!)
    const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;

    if (!TOSS_SECRET_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다',
          hint: 'Netlify 대시보드 > Site settings > Environment variables 에서 설정하세요'
        })
      };
    }

    // 토스페이먼츠 결제 승인 API 호출
    const auth = Buffer.from(TOSS_SECRET_KEY + ':').toString('base64');

    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: Number(amount)
      })
    });

    const result = await response.json();

    // 결제 승인 실패
    if (!response.ok) {
      console.error('토스 결제 승인 실패:', result);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: result.message || '결제 승인에 실패했습니다',
          code: result.code
        })
      };
    }

    // 결제 승인 성공
    console.log('결제 승인 성공:', orderId, amount);

    // 여기서 추가 작업 가능:
    // 1. DB에 결제 기록 저장
    // 2. 관리자 이메일/카톡 알림 전송
    // 3. Google Sheets에 자동 기록
    // 4. 세금계산서 자동 발행 요청
    // 등...

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        orderId: result.orderId,
        orderName: result.orderName,
        amount: result.totalAmount,
        method: result.method,
        approvedAt: result.approvedAt,
        receipt: result.receipt?.url
      })
    };

  } catch (error) {
    console.error('결제 처리 중 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: '결제 처리 중 서버 오류가 발생했습니다',
        details: error.message
      })
    };
  }
};
