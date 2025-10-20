import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'sync_state' })
@Index(['network', 'contractAddress', 'lockId'], { unique: true })
export class SyncStateEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'text' })
  network!: string; // e.g., 'sepolia' | 'mainnet'

  @Column({ type: 'text' })
  contractAddress!: string; // monitored contract address

  @Column({ type: 'text' })
  lockId!: string; // monitored lock id

  @Column({ type: 'integer', default: 0 })
  lastSyncedBlock!: number; // inclusive: we have scanned up to and including this block

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
