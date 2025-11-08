import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
/**
 * Lock configuration entity - stores lock ID and public key
 * Singleton entity (always id=1) to ensure only one lock is configured at a time
 */
@Entity('lock_config')
export class LockConfigEntity {
  @PrimaryColumn()
  id: number = 1; // Always use ID 1 for singleton config

  @Column({ type: 'integer' })
  lockId: number;

  @Column({ type: 'text' })
  publicKey: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
