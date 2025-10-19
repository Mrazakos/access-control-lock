import { Module } from '@nestjs/common';
import { NfcAdapterService } from './nfc-adapter.service';

@Module({
  providers: [NfcAdapterService],
  exports: [NfcAdapterService],
})
export class NfcModule {}
