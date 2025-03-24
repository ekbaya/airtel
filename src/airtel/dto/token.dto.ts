import { IsString, IsNotEmpty } from 'class-validator';

export class TokenRequestDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  client_secret: string;

  @IsString()
  @IsNotEmpty()
  grant_type: string;
}

export class TokenResponseDto {
  access_token: string;
  expires_in: number;
  token_type: string;
}
