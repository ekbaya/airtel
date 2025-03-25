export interface EncryptionKeysResponse {
  data: {
    key_id: number;
    key: string;
    valid_upto: string;
  };
  status: {
    code: string;
    message: string;
    response_code: string;
    result_code: string;
    success: boolean;
  };
}
