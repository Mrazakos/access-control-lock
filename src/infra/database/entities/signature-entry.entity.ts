import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('signature_entries')
@Index(['signatureHash']) // Index on signatureHash
@Index(['timestamp']) // Index on timestamp
export class SignatureEntryEntity {
  @PrimaryColumn()
  id: string; // Unique entry ID

  @Column()
  signatureHash: string; // Hash of the signature that was used/verified

  @Column({ nullable: true })
  publicKey: string; // Public key of the lock (optional)

  @Column({ type: 'datetime' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
