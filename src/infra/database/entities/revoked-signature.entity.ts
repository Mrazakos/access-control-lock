import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('revoked_signatures')
export class RevokedSignatureEntity {
  @PrimaryColumn()
  id: string; // signatureHash (unique since we only monitor one lock)

  @Column()
  @Index()
  signatureHash: string; // bytes32 hash from contract

  @Column()
  blockNumber: number;

  @Column({ type: 'datetime' })
  revokedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
