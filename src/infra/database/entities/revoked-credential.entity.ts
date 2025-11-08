import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('revoked_credentials')
export class RevokedCredentialEntity {
  @PrimaryColumn()
  id: string; // vcHash (unique since we only monitor one lock)

  @Column()
  @Index()
  vcHash: string; // bytes32 hash of the VC from contract

  @Column()
  blockNumber: number;

  @Column({ type: 'datetime' })
  revokedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
