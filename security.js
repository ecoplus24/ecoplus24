// 1. 마우스 우클릭 금지
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  alert("에코플러스의 기술 자산 보호를 위해 우클릭이 제한됩니다.");
});

// 2. 단축키(F12, Ctrl+Shift+I 등) 차단
document.onkeydown = function(e) {
  // F12 키 차단
  if (e.keyCode == 123) {
    showWarning();
    return false;
  }
  // Ctrl + Shift + I (개발자 도구) 차단
  if (e.ctrlKey && e.shiftKey && e.keyCode == 73) {
    showWarning();
    return false;
  }
  // Ctrl + Shift + J (콘솔) 차단
  if (e.ctrlKey && e.shiftKey && e.keyCode == 74) {
    showWarning();
    return false;
  }
  // Ctrl + U (소스 보기) 차단
  if (e.ctrlKey && e.keyCode == 85) {
    showWarning();
    return false;
  }
};

function showWarning() {
  alert("보안 정책에 따라 코드 분석 및 개발자 도구 활용이 제한됩니다.");
}