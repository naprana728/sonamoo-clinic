/**
 * 소나무 한의원 경영 관리 시스템 (대안 A: 무설치 웹 버전) - 비즈니스 로직 및 상태 관리
 * 모든 변수명, 주석, 로직은 한국어 명세에 맞춰 작성되었습니다.
 */

// 1. 카테고리 데이터 모델 정의
const 카테고리_설정 = {
  revenue: { // 매출 카테고리
    "급여 매출": ["급여 매출"],
    "비급여 매출": ["첩약", "약침", "추나", "기타"],
    "자동차보험": ["자동차보험"]
  },
  expense: { // 지출 카테고리
    "지출": ["인건비", "약재비", "임대료", "직원복지후생비", "소모품비", "기타", "환불"]
  }
};

// 전역 애플리케이션 상태
let 거래_데이터 = [];
let 삭제된_거래_데이터 = []; // 신규: 잘못 입력하여 삭제된 기록 보관용
let 매출_유형_차트_객체 = null;
let 비급여_차트_객체 = null;
let 비교_바_차트_객체 = null;
let 현재_입력_유형 = 'revenue'; // 'revenue' 또는 'expense'

// DOM 요소 참조
const 요소 = {
  입력폼: document.getElementById('transaction-form'),
  날짜입력: document.getElementById('transaction-date'),
  대분류그룹: document.getElementById('main-category-group'),
  대분류선택: document.getElementById('main-category'),
  소분류선택: document.getElementById('sub-category'),
  금액입력: document.getElementById('transaction-amount'),
  메모입력: document.getElementById('transaction-memo'),
  등록버튼: document.getElementById('submit-btn'),
  
  매출버튼: document.getElementById('type-revenue-btn'),
  지출버튼: document.getElementById('type-expense-btn'),
  
  총매출값: document.getElementById('net-profit-val'), // UI상의 총매출 카드 매핑
  총급여값: document.getElementById('total-revenue-val'), // UI상의 총급여 카드 매핑
  총비급여값: document.getElementById('expense-ratio-val'), // UI상의 총비급여 카드 매핑
  총지출값: document.getElementById('total-expense-val'), // UI상의 총지출 카드 매핑
  
  필터시작일: document.getElementById('filter-start-date'),
  필터종료일: document.getElementById('filter-end-date'),
  필터구분: document.getElementById('filter-type'),
  테이블바디: document.getElementById('transaction-list-body'),
  빈상태: document.getElementById('empty-state'),
  
  // 신규: 삭제 내역 DOM
  삭제테이블바디: document.getElementById('deleted-list-body'),
  삭제빈상태: document.getElementById('deleted-empty-state'),
  삭제전체비우기버튼: document.getElementById('clear-trash-btn'),
  
  백업버튼: document.getElementById('export-btn'),
  복원버튼트리거: document.getElementById('import-trigger-btn'),
  파일입력: document.getElementById('import-file-input'),
  현재시간표시: document.getElementById('current-time')
};

// 2. 초기화 함수
document.addEventListener('DOMContentLoaded', () => {
  초기_날짜_설정();
  실시간_시간_표시();
  데이터_로드();
  소분류_동적_업데이트();
  이벤트_리스너_등록();
  화면_새로고침();
});

// 날짜 초기화 (입력 폼은 오늘 날짜, 필터 날짜는 이번 달 1일 ~ 오늘 날짜)
function 초기_날짜_설정() {
  const 오늘 = new Date();
  const 연도 = 오늘.getFullYear();
  const 월 = String(오늘.getMonth() + 1).padStart(2, '0');
  const 일 = String(todayDate() ? todayDate().getDate() : 오늘.getDate()).padStart(2, '0');
  
  // 입력 필드는 오늘로 고정
  요소.날짜입력.value = `${연도}-${월}-${일}`;
  
  // 기간 필터의 기본값 세팅 (이번 달 1일 ~ 오늘)
  요소.필터시작일.value = `${연도}-${월}-01`;
  요소.필터종료일.value = `${연도}-${월}-${일}`;
}

// 헬퍼: 현재 시각의 Date 객체 가져오기 (시간 고정 방지)
function todayDate() {
  return new Date();
}

function 실시간_시간_표시() {
  const 요일 = ['일', '월', '화', '수', '목', '금', '토'];
  const 업데이트 = () => {
    const 현재 = new Date();
    const 연도 = 현재.getFullYear();
    const 월 = String(현재.getMonth() + 1).padStart(2, '0');
    const 일 = String(currentlyDateValue(현재)).padStart(2, '0');
    const 요일명 = 요일[현재.getDay()];
    const 시 = String(현재.getHours()).padStart(2, '0');
    const 분 = String(currentMinutes(현재)).padStart(2, '0');
    
    요소.currentlyFormattedTime = `${연도}년 ${월}월 ${일}일 (${요일명}) ${시}:${분}`;
    요소.현재시간표시.textContent = 요소.currentlyFormattedTime;
  };
  
  업데이트();
  setInterval(업데이트, 30000); // 30초마다 업데이트
}

function currentlyDateValue(date) {
  return date.getDate();
}

function currentMinutes(date) {
  return date.getMinutes();
}

// 3. 데이터 저장소 관리 (LocalStorage)
function 데이터_로드() {
  const 로컬데이터 = localStorage.getItem('clinic_transactions_v2');
  const 삭제로컬데이터 = localStorage.getItem('clinic_deleted_transactions_v2');
  
  if (로컬데이터) {
    try {
      거래_데이터 = JSON.parse(로컬데이터);
    } catch (e) {
      console.error('거래 데이터 파싱 실패. 초기화합니다.', e);
      거래_데이터 = [];
    }
  } else {
    // 테스트용 목데이터 주입
    거래_데이터 = 목데이터_생성();
    데이터_저장();
  }

  if (삭제로컬데이터) {
    try {
      삭제된_거래_데이터 = JSON.parse(삭제로컬데이터);
    } catch (e) {
      console.error('삭제된 데이터 파싱 실패. 초기화합니다.', e);
      삭제된_거래_데이터 = [];
    }
  } else {
    삭제된_거래_데이터 = [];
  }
}

function 데이터_저장() {
  localStorage.setItem('clinic_transactions_v2', JSON.stringify(거래_데이터));
  localStorage.setItem('clinic_deleted_transactions_v2', JSON.stringify(삭제된_거래_데이터));
}

function 목데이터_생성() {
  const 오늘 = new Date();
  const 연도 = 오늘.getFullYear();
  const 월 = String(오늘.getMonth() + 1).padStart(2, '0');
  
  return [
    {
      id: Date.now() - 500000,
      date: `${연도}-${월}-01`,
      type: 'revenue',
      category: '급여 매출',
      subCategory: '급여 매출',
      amount: 1500000,
      memo: '국민건강보험 공단 침치료 급여 청구분'
    },
    {
      id: Date.now() - 400000,
      date: `${연도}-${월}-02`,
      type: 'revenue',
      category: '비급여 매출',
      subCategory: '첩약',
      amount: 450000,
      memo: '김민수님 만성피로 보약 (녹용 함유)'
    },
    {
      id: Date.now() - 300000,
      date: `${연도}-${월}-03`,
      type: 'revenue',
      category: '자동차보험',
      subCategory: '자동차보험',
      amount: 250000,
      memo: '자보 교통사고 환자 물리치료 외'
    },
    {
      id: Date.now() - 250000,
      date: `${연도}-${월}-05`,
      type: 'expense',
      category: '지출',
      subCategory: '임대료',
      amount: 1500000,
      memo: '한의원 원세 송금'
    },
    {
      id: Date.now() - 200000,
      date: `${연도}-${월}-08`,
      type: 'revenue',
      category: '비급여 매출',
      subCategory: '약침',
      amount: 320000,
      memo: '도침 및 산삼약침 환자 시술분'
    },
    {
      id: Date.now() - 150000,
      date: `${연도}-${월}-10`,
      type: 'revenue',
      category: '비급여 매출',
      subCategory: '추나',
      amount: 180000,
      memo: '척추 교정 추나 요법 시행'
    },
    {
      id: Date.now() - 100000,
      date: `${연도}-${월}-12`,
      type: 'expense',
      category: '지출',
      subCategory: '약재비',
      amount: 680000,
      memo: '청풍약품 우슬, 당귀 약재 구입'
    },
    {
      id: Date.now() - 50000,
      date: `${연도}-${월}-15`,
      type: 'expense',
      category: '지출',
      subCategory: '소모품비',
      amount: 85000,
      memo: '일회용 침 및 부항 부자재 구매'
    }
  ];
}

// 4. 카테고리 동적 셀렉트 박스 처리
function 소분류_동적_업데이트() {
  let 소분류_목록 = [];
  
  if (현재_입력_유형 === 'revenue') {
    const 선택된_대분류 = 요소.대분류선택.value;
    소분류_목록 = 카테고리_설정.revenue[선택된_대분류] || [];
  } else {
    소분류_목록 = 카테고리_설정.expense["지출"];
  }

  요소.소분류선택.innerHTML = '';
  소분류_목록.forEach(항목 => {
    const 옵션 = document.createElement('option');
    옵션.value = 항목;
    옵션.textContent = 항목;
    요소.소분류선택.appendChild(옵션);
  });
}

// 금액 천 단위 포맷팅
function 금액_포맷팅(값) {
  const 숫자만 = 값.replace(/[^0-9]/g, '');
  if (!숫자만) return '';
  return Number(숫자만).toLocaleString('ko-KR');
}

function 금액_역포맷팅(값) {
  return Number(값.replace(/,/g, '')) || 0;
}

// 5. 이벤트 리스너 등록
function 이벤트_리스너_등록() {
  요소.매출버튼.addEventListener('click', () => 입력_유형_전환('revenue'));
  요소.지출버튼.addEventListener('click', () => 입력_유형_전환('expense'));
  요소.대분류선택.addEventListener('change', 소분류_동적_업데이트);
  
  요소.금액입력.addEventListener('input', (e) => {
    e.target.value = 금액_포맷팅(e.target.value);
  });
  
  요소.입력폼.addEventListener('submit', 거래_등록);
  
  // 날짜 범위 및 필터 변경 시 내역 리렌더링
  요소.필터시작일.addEventListener('change', 화면_새로고침);
  요소.필터종료일.addEventListener('change', 화면_새로고침);
  요소.필터구분.addEventListener('change', 화면_새로고침);
  
  // 삭제 이력 전체 비우기
  요소.삭제전체비우기버튼.addEventListener('click', 삭제_기록_비우기);
  
  // 백업 및 복원
  요소.백업버튼.addEventListener('click', 데이터_내보내기);
  요소.복원버튼트리거.addEventListener('click', () => 요소.파일입력.click());
  요소.파일입력.addEventListener('change', 데이터_가져오기);
}

// 입력 유형 전환 (매출 <=> 지출)
function 입력_유형_전환(유형) {
  현재_입력_유형 = 유형;
  
  if (유형 === 'revenue') {
    요소.매출버튼.classList.add('active');
    요소.지출버튼.classList.remove('active');
    요소.대분류그룹.style.display = 'block';
    요소.등록버튼.style.background = 'var(--accent-blue)';
    요소.등록버튼.textContent = '💾 매출 기록 저장';
  } else {
    요소.지출버튼.classList.add('active');
    요소.매출버튼.classList.remove('active');
    요소.대분류그룹.style.display = 'none';
    요소.등록버튼.style.background = 'var(--accent-red)';
    요소.등록버튼.textContent = '💾 지출 기록 저장';
  }
  
  소분류_동적_업데이트();
}

// 6. 거래 등록
function 거래_등록(e) {
  e.preventDefault();
  
  const 날짜 = 요소.날짜입력.value;
  const 금액 = 금액_역포맷팅(요소.금액입력.value);
  const 메모 = 요소.메모입력.value.trim();
  
  if (금액 <= 0) {
    alert('올바른 금액을 입력해 주세요.');
    return;
  }
  
  let 대분류 = '지출';
  if (현재_입력_유형 === 'revenue') {
    대분류 = 요소.대분류선택.value;
  }
  
  const 소분류 = 요소.소분류선택.value;
  
  const 새거래 = {
    id: Date.now(),
    date: 날짜,
    type: 현재_입력_유형,
    category: 대분류,
    subCategory: 소분류,
    amount: 금액,
    memo: 메모
  };
  
  거래_데이터.push(새거래);
  거래_데이터.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  데이터_저장();
  화면_새로고침();
  
  요소.금액입력.value = '';
  요소.메모입력.value = '';
  
  alert('거래 기록이 등록되었습니다.');
}

// 7. 거래 삭제 (영구 삭제가 아닌 임시 삭제 -> 휴지통 이동)
function 거래_삭제(id) {
  const 삭제대상 = 거래_데이터.find(t => t.id === id);
  if (!삭제대상) return;
  
  if (confirm(`선택한 [${삭제대상.category} - ${삭제대상.subCategory}] 거래 기록을 삭제하시겠습니까?\n(삭제된 기록은 하단 휴지통으로 이동하며 언제든 복구할 수 있습니다.)`)) {
    // 삭제 시간 추가
    const 현재시각 = new Date();
    삭제대상.deletedAt = `${현재시각.getFullYear()}-${String(현재시각.getMonth()+1).padStart(2,'0')}-${String(현재시각.getDate()).padStart(2,'0')} ${String(현재시각.getHours()).padStart(2,'0')}:${String(현재시각.getMinutes()).padStart(2,'0')}`;
    
    // 이력 이동
    삭제된_거래_데이터.push(삭제대상);
    
    // 정렬 (삭제 최신순)
    삭제된_거래_데이터.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
    
    // 원본 데이터에서 제외
    거래_데이터 = 거래_데이터.filter(t => t.id !== id);
    
    데이터_저장();
    화면_새로고침();
  }
}

// 신규: 삭제 거래 복구
function 거래_복구(id) {
  const 복구대상 = 삭제된_거래_데이터.find(t => t.id === id);
  if (!복구대상) return;
  
  if (confirm(`선택한 [${복구대상.category} - ${복구대상.subCategory}] 내역을 원래 거래 상세 내역으로 복구하시겠습니까?`)) {
    // 삭제 시간 마크 제거
    delete 복구대상.deletedAt;
    
    // 원본 데이터 복원 및 정렬
    거래_데이터.push(복구대상);
    거래_데이터.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 삭제 목록에서 제거
    삭제된_거래_데이터 = 삭제된_거래_데이터.filter(t => t.id !== id);
    
    데이터_저장();
    화면_새로고침();
    alert('성공적으로 복원되었습니다.');
  }
}

// 신규: 삭제된 특정 거래의 영구 삭제
function 영구_삭제(id) {
  const 삭제대상 = 삭제된_거래_데이터.find(t => t.id === id);
  if (!삭제대상) return;
  
  if (confirm(`[경고] [${삭제대상.category} - ${삭제대상.subCategory}] 내역을 완전히 영구 삭제하시겠습니까?\n이 작업은 다시 복구할 수 없습니다.`)) {
    삭제된_거래_데이터 = 삭제된_거래_데이터.filter(t => t.id !== id);
    데이터_저장();
    화면_새로고침();
  }
}

// 신규: 삭제 기록 전체 비우기
function 삭제_기록_비우기() {
  if (삭제된_거래_데이터.length === 0) {
    alert('비울 삭제 기록이 없습니다.');
    return;
  }
  
  if (confirm('휴지통의 모든 삭제 기록을 영구적으로 비우시겠습니까?\n비운 데이터는 복구할 수 없습니다.')) {
    삭제된_거래_데이터 = [];
    데이터_저장();
    화면_새로고침();
    alert('삭제 기록이 모두 영구 삭제되었습니다.');
  }
}

// 8. 화면 및 통계 갱신
function 화면_새로고침() {
  const 필터된_목록 = 필터링된_데이터_가져오기();
  대시보드_통계_계산(필터된_목록);
  내역_테이블_렌더링(필터된_목록);
  삭제_내역_테이블_렌더링(); // 신규 추가
  차트_시각화_업데이트(필터된_목록);
}

// 시작일~종료일 날짜 범위를 반영한 필터링 함수
function 필터링된_데이터_가져오기() {
  const 시작일_값 = 요소.필터시작일.value;
  const 종료일_값 = 요소.필터종료일.value;
  const 구분필터 = 요소.필터구분.value;
  
  const 시작날짜 = 시작일_값 ? new Date(시작일_값) : null;
  const 종료날짜 = 종료일_값 ? new Date(종료일_값) : null;
  
  return 거래_데이터.filter(거래 => {
    const 거래날짜 = new Date(거래.date);
    
    // 1. 기간 필터링
    let 기간_일치 = true;
    if (시작날짜 && 거래날짜 < 시작날짜) 기간_일치 = false;
    if (종료날짜 && 거래날짜 > 종료날짜) 기간_일치 = false;
    
    // 2. 구분 필터링
    let 구분_일치 = true;
    if (구분필터 !== 'all') {
      구분_일치 = 거래.type === 구분필터;
    }
    
    return 기간_일치 && 구분_일치;
  });
}

// 통계 지표 계산 (선택 기간 기준)
function 대시보드_통계_계산(필터된_데이터) {
  let 총매출 = 0;
  let 총급여 = 0;
  let 총비급여 = 0;
  let 총지출 = 0;
  
  필터된_데이터.forEach(거래 => {
    if (거래.type === 'revenue') {
      총매출 += 거래.amount;
      if (거래.category === '급여 매출') {
        총급여 += 거래.amount;
      } else if (거래.category === '비급여 매출') {
        총비급여 += 거래.amount;
      }
    } else {
      총지출 += 거래.amount;
    }
  });
  
  // UI 갱신
  요소.총매출값.textContent = 총매출.toLocaleString('ko-KR') + '원';
  요소.총급여값.textContent = 총급여.toLocaleString('ko-KR') + '원';
  요소.총비급여값.textContent = 총비급여.toLocaleString('ko-KR') + '원';
  요소.총지출값.textContent = 총지출.toLocaleString('ko-KR') + '원';
}

// 테이블 행 출력
function 내역_테이블_렌더링(필터된_데이터) {
  요소.테이블바디.innerHTML = '';
  
  if (필터된_데이터.length === 0) {
    요소.빈상태.style.display = 'block';
    return;
  } else {
    요소.빈상태.style.display = 'none';
  }
  
  필터된_데이터.forEach(거래 => {
    const tr = document.createElement('tr');
    const 구분텍스트 = 거래.type === 'revenue' ? '매출' : '지출';
    const 구분클래스 = 거래.type === 'revenue' ? 'revenue' : 'expense';
    
    tr.innerHTML = `
      <td class="en-font">${거래.date}</td>
      <td><span class="badge-type ${구분클래스}">${구분텍스트}</span></td>
      <td>${거래.category}</td>
      <td>${거래.subCategory}</td>
      <td class="text-right en-font" style="font-weight: 600; color: ${거래.type === 'revenue' ? 'var(--accent-blue)' : 'var(--accent-red)'}">
        ${거래.type === 'revenue' ? '+' : '-'}${거래.amount.toLocaleString('ko-KR')}원
      </td>
      <td style="color: var(--text-secondary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${거래.memo || ''}">
        ${거래.memo || '-'}
      </td>
      <td class="text-center">
        <button type="button" class="delete-btn" onclick="거래_삭제(${거래.id})" title="삭제">🗑️</button>
      </td>
    `;
    요소.테이블바디.appendChild(tr);
  });
}

// 신규: 삭제 목록 테이블 출력
function 삭제_내역_테이블_렌더링() {
  요소.삭제테이블바디.innerHTML = '';
  
  if (삭제된_거래_데이터.length === 0) {
    요소.삭제빈상태.style.display = 'block';
    return;
  } else {
    요소.삭제빈상태.style.display = 'none';
  }
  
  삭제된_거래_데이터.forEach(거래 => {
    const tr = document.createElement('tr');
    const 구분텍스트 = 거래.type === 'revenue' ? '매출' : '지출';
    const 구분클래스 = 거래.type === 'revenue' ? 'revenue' : 'expense';
    
    tr.innerHTML = `
      <td>
        <span class="badge-type ${구분클래스}" style="margin-right: 0.5rem;">${구분텍스트}</span>
        <span class="en-font" style="font-size: 0.85rem;">${거래.date}</span>
      </td>
      <td>${거래.category} > ${거래.subCategory}</td>
      <td class="text-right en-font" style="font-weight: 600; color: var(--text-muted);">
        ${거래.amount.toLocaleString('ko-KR')}원
      </td>
      <td style="color: var(--text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${거래.memo || ''}">
        ${거래.memo || '-'}
      </td>
      <td class="en-font" style="font-size: 0.8rem; color: var(--text-muted);">${거래.deletedAt}</td>
      <td class="text-center" style="display: flex; gap: 0.5rem; justify-content: center;">
        <button type="button" class="btn btn-secondary" onclick="거래_복구(${거래.id})" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; width: auto; background: var(--bg-tertiary);">🔄 복구</button>
        <button type="button" class="btn btn-secondary" onclick="영구_삭제(${거래.id})" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; width: auto; border-color: var(--accent-red); color: var(--accent-red); background: none;">❌ 영구삭제</button>
      </td>
    `;
    요소.삭제테이블바디.appendChild(tr);
  });
}

// 9. Chart.js 시각화 갱신
function 차트_시각화_업데이트(필터된_데이터) {
  const 다크모드_여부 = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const 글꼴_색상 = 다크모드_여부 ? 'hsl(40, 25%, 92%)' : 'hsl(140, 35%, 15%)';
  const 그리드_색상 = 다크모드_여부 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

  // 1) 매출 데이터 가공 (급여 매출 vs 비급여 매출)
  const 매출데이터 = 필터된_데이터.filter(t => t.type === 'revenue');
  let 급여_합계 = 0;
  let 비급여_합계 = 0;
  
  매출데이터.forEach(t => {
    if (t.category === '급여 매출') 급여_합계 += t.amount;
    if (t.category === '비급여 매출') 비급여_합계 += t.amount;
  });
  
  // 차트 1: 급여 vs 비급여 파이 차트
  if (매출_유형_차트_객체) 매출_유형_차트_객체.destroy();
  if (급여_합계 > 0 || 비급여_합계 > 0) {
    const ctx1 = document.getElementById('revenue-type-chart').getContext('2d');
    매출_유형_차트_객체 = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: ['급여 매출', '비급여 매출'],
        datasets: [{
          data: [급여_합계, 비급여_합계],
          backgroundColor: ['hsl(212, 65%, 48%)', 'hsl(140, 35%, 40%)'],
          borderWidth: 다크모드_여부 ? 2 : 1,
          borderColor: 다크모드_여부 ? 'hsl(140, 18%, 12%)' : '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: 글꼴_색상, font: { family: 'Noto Sans KR', size: 11 } }
          }
        }
      }
    });
  } else {
    대체_차트_캔버스_표시('revenue-type-chart', '기간 내 매출 내역이 없습니다.');
  }

  // 2) 비급여 항목별(첩약/약침/추나/기타) 세부 비중 파이 차트
  const 비급여_금액 = { '첩약': 0, '약침': 0, '추나': 0, '기타': 0 };
  let 비급여_총액 = 0;
  
  매출데이터.filter(t => t.category === '비급여 매출').forEach(t => {
    if (비급여_금액[t.subCategory] !== undefined) {
      비급여_금액[t.subCategory] += t.amount;
      비급여_총액 += t.amount;
    }
  });

  if (비급여_차트_객체) 비급여_차트_객체.destroy();
  if (비급여_총액 > 0) {
    const ctx2 = document.getElementById('non-benefit-chart').getContext('2d');
    비급여_차트_객체 = new Chart(ctx2, {
      type: 'pie',
      data: {
        labels: Object.keys(비급여_금액),
        datasets: [{
          data: Object.values(비급여_금액),
          backgroundColor: [
            'hsl(35, 50%, 55%)',  // 첩약 (골드 계열)
            'hsl(140, 30%, 55%)', // 약침 (그린 계열)
            'hsl(180, 40%, 50%)', // 추나 (청록 계열)
            'hsl(280, 45%, 60%)'  // 기타 (보라 계열)
          ],
          borderWidth: 다크모드_여부 ? 2 : 1,
          borderColor: 다크모드_여부 ? 'hsl(140, 18%, 12%)' : '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: 글꼴_색상, font: { family: 'Noto Sans KR', size: 11 } }
          }
        }
      }
    });
  } else {
    대체_차트_캔버스_표시('non-benefit-chart', '기간 내 비급여 매출이 없습니다.');
  }

  // 3) 매출 대비 지출 비교 바 차트 (총매출 vs 총지출)
  let 총매출_액 = 0;
  let 총지출_액 = 0;
  
  필터된_데이터.forEach(t => {
    if (t.type === 'revenue') 총매출_액 += t.amount;
    else 총지출_액 += t.amount;
  });

  if (비교_바_차트_객체) 비교_바_차트_객체.destroy();
  const ctx3 = document.getElementById('comparison-bar-chart').getContext('2d');
  비교_바_차트_객체 = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: ['총 매출액', '총 지출액'],
      datasets: [{
        label: '재무 현황 비교',
        data: [총매출_액, 총지출_액],
        backgroundColor: ['rgba(49, 130, 206, 0.8)', 'rgba(229, 62, 62, 0.8)'],
        borderColor: ['rgb(49, 130, 206)', 'rgb(229, 62, 62)'],
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 글꼴_색상, font: { family: 'Noto Sans KR' } }
        },
        y: {
          grid: { color: 그리드_색상 },
          ticks: { 
            color: 글꼴_색상,
            font: { family: 'Outfit', size: 10 },
            callback: function(val) { return val.toLocaleString('ko-KR') + '원'; }
          }
        }
      }
    }
  });
}

function 대체_차트_캔버스_표시(캔버스ID, 메시지) {
  const canvas = document.getElementById(캔버스ID);
  const ctx = canvas.getContext('2d');
  const 다크모드_여부 = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const 글꼴_색상 = 다크모드_여부 ? 'hsl(140, 8%, 50%)' : 'hsl(140, 10%, 60%)';
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 글꼴_색상;
  ctx.font = '13px Noto Sans KR';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(메시지, canvas.width / 2, canvas.height / 2);
}

// 10. 데이터 백업 및 복원 기능 (삭제 기록 확장 연동)
function 데이터_내보내기() {
  if (거래_데이터.length === 0 && 삭제된_거래_데이터.length === 0) {
    alert('내보낼 데이터가 존재하지 않습니다.');
    return;
  }
  
  // 백업 파일 포맷 고도화 (버전 관리 및 다중 객체 배열 내보내기)
  const 백업_데이터 = {
    version: "2.0",
    transactions: 거래_데이터,
    deletedTransactions: 삭제된_거래_데이터
  };
  
  const 데이터_문자열 = JSON.stringify(백업_데이터, null, 2);
  const 파일 = new Blob([데이터_문자열], {type: 'application/json'});
  
  const 오늘 = new Date();
  const 날짜형식 = 오늘.getFullYear() + String(오늘.getMonth() + 1).padStart(2, '0') + String(오늘.getDate()).padStart(2, '0');
  const 파일이름 = `소나무한의원_종합재무_백업_${날짜형식}.json`;
  
  const a = document.createElement('a');
  const url = URL.createObjectURL(파일);
  a.href = url;
  a.download = 파일이름;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);  
  }, 0);
}

function 데이터_가져오기(e) {
  const 파일 = e.target.files[0];
  if (!파일) return;
  
  const 리더 = new FileReader();
  리더.onload = function(event) {
    try {
      const 파싱데이터 = JSON.parse(event.target.result);
      
      // 1) 레거시 1.0 백업 형식(순수 단일 거래 배열)과의 하방 호환성 처리
      if (Array.isArray(파싱데이터)) {
        const 형식확인 = 파싱데이터.every(t => t.id && t.date && t.type && t.category && t.subCategory && t.amount !== undefined);
        if (!형식확인 && 파싱데이터.length > 0) throw new Error('데이터 스키마 구조가 호환되지 않습니다.');
        
        if (confirm(`이전 버전 백업 파일의 거래 기록 ${파싱데이터.length}개를 가져오시겠습니까? 기존의 데이터와 삭제 내역이 모두 덮어씌워집니다.`)) {
          거래_데이터 = 파싱데이터;
          삭제된_거래_데이터 = []; // 레거시는 삭제 로그가 없음
          데이터_저장();
          화면_새로고침();
          alert('성공적으로 데이터가 이전 버전에서 복원되었습니다.');
        }
      }
      // 2) 신버전 2.0 백업 형식 (거래 및 삭제 목록 동시 수용 구조)
      else if (파싱데이터.version === "2.0" && 파싱데이터.transactions) {
        const 거래_갯수 = 파싱데이터.transactions.length;
        const 삭제_갯수 = 파싱데이터.deletedTransactions ? 파싱데이터.deletedTransactions.length : 0;
        
        if (confirm(`백업 파일에서 거래 기록 ${거래_갯수}개 및 삭제 로그 ${삭제_갯수}개를 복원하시겠습니까? 기존의 데이터는 모두 덮어씌워집니다.`)) {
          거래_데이터 = 파싱데이터.transactions;
          삭제된_거래_데이터 = 파싱데이터.deletedTransactions || [];
          데이터_저장();
          화면_새로고침();
          alert('성공적으로 모든 데이터 및 삭제 로그가 복원되었습니다.');
        }
      } else {
        throw new Error('올바른 백업 규격 파일이 아닙니다.');
      }
    } catch (err) {
      alert(`복원 실패: ${err.message}`);
    }
  };
  리더.readAsText(파일);
  e.target.value = '';
}

// 전역 윈도우 스코프 함수 노출 (인라인 onClick 바인딩 대응)
window.거래_삭제 = 거래_삭제;
window.거래_복구 = 거래_복구;
window.영구_삭제 = 영구_삭제;
