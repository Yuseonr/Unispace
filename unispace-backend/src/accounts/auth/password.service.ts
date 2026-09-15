import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  async hash(password: string) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async verify(password: string, encodedHash: string) {
    return bcrypt.compare(password, encodedHash);
  }
}
