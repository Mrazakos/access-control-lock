import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncStateEntity } from './entities';

@Injectable()
export class SyncStateRepository {
  constructor(
    @InjectRepository(SyncStateEntity)
    private readonly repo: Repository<SyncStateEntity>,
  ) {}

  private normalize(address: string): string {
    return address.toLowerCase();
  }

  async getOrCreate(
    network: string,
    contractAddress: string,
    lockId: string,
  ): Promise<SyncStateEntity> {
    const normalizedAddress = this.normalize(contractAddress);
    let state = await this.repo.findOne({
      where: { network, contractAddress: normalizedAddress, lockId },
    });
    if (!state) {
      state = this.repo.create({
        network,
        contractAddress: normalizedAddress,
        lockId,
        lastSyncedBlock: 0,
      });
      await this.repo.save(state);
    }
    return state;
  }

  async updateLastSyncedBlock(
    network: string,
    contractAddress: string,
    lockId: string,
    lastSyncedBlock: number,
  ): Promise<void> {
    const normalizedAddress = this.normalize(contractAddress);
    await this.repo
      .createQueryBuilder()
      .update(SyncStateEntity)
      .set({ lastSyncedBlock })
      .where('network = :network AND contractAddress = :contractAddress AND lockId = :lockId', {
        network,
        contractAddress: normalizedAddress,
        lockId,
      })
      .execute();
  }

  async getLastSyncedBlock(
    network: string,
    contractAddress: string,
    lockId: string,
  ): Promise<number | null> {
    const normalizedAddress = this.normalize(contractAddress);
    const state = await this.repo.findOne({
      where: { network, contractAddress: normalizedAddress, lockId },
    });
    return state ? state.lastSyncedBlock : null;
  }
}
