// 11단계: 설치형 웹앱(서비스 워커 등록)과 기기 승인 상태 표시입니다.
// 설치 여부는 안내로만 보여 줍니다. 기기 승인은 서버가 정하며, 이 화면은 승인 여부를 스스로 정하지 않습니다.
// 기기 키·토큰은 이 파일에서 만들거나 저장하지 않습니다.
const installState = document.querySelector('#install-state');

const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
installState.textContent = installed
  ? '설치형 앱으로 열었습니다. 설치는 기기 승인이 아닙니다.'
  : '브라우저에서 열었습니다. 설치하지 않아도 같은 자료실입니다.';

// 기기 승인 상태는 auth.js가 서버(/api/devices)의 기록만 보고 표시합니다.

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
    // 서비스 워커를 쓸 수 없는 브라우저에서는 오프라인 안내만 빠지고 나머지는 그대로 동작합니다.
  });
}
