export interface MainPickupCSV {
  "일섭 날짜": string;
  "한섭 날짜": string;
  내역: string;
}

export interface RewardCSV {
  "일섭 날짜": string;
  "한섭 날짜": string;
  이름: string;
  무료쥬얼: string;
  캐릭티켓: string;
  서폿티켓: string;
  "무지개 조각": string;
}

export interface Field {
  name: string;
  value: string;
}
