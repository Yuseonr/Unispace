import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from './password.constants';

@Injectable()
export class PasswordService {
  async hash(password: string) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async verify(password: string, encodedHash: string) {
    return bcrypt.compare(password, encodedHash);
  }
}
