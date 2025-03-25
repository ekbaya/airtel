export interface CallbackTransactionData {
  id: string;
  message: string;
  status_code: string;
  airtel_money_id: string;
}

export interface CallbackRequestDto {
  transaction: CallbackTransactionData;
  hash?: string;
}
