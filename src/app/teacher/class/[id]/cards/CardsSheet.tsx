import { Blob, type BlobColor } from '@/components/blob/Blob';
import { toBlobColor } from '@/lib/blobColors';
import { koCards } from '@/lib/copy.ko';
import styles from './cards.module.css';

export interface CardData {
  id: string; name: string; blobColor: string | null;
  /** The full /s/<secret> URL the QR encodes. */
  url: string;
  /** Pre-rendered QR svg for `url`. */
  svg: string;
}

/** The printable sheet: 8 cards per A4 page (2 x 4). Presentational; the page owns auth and data. */
export function CardsSheet({ cards, classCode, siteAddress }: { cards: CardData[]; classCode: string; siteAddress: string }) {
  const pages: CardData[][] = [];
  for (let i = 0; i < cards.length; i += 8) pages.push(cards.slice(i, i + 8));
  return (
    <div className={styles.sheets}>
      {pages.map((page, n) => (
        <ul key={n} className={styles.page}>
          {page.map((c) => (
            <li key={c.id} className={styles.card}>
              <div className={styles.who}>
                {c.blobColor ? (
                  <span className={styles.blob} data-testid="card-blob"><Blob color={toBlobColor(c.blobColor) as BlobColor} mood="happy" size={56} /></span>
                ) : null}
                <span className={styles.name}>{c.name}</span>
              </div>
              <div className={styles.qr} data-qr-url={c.url} role="img" aria-label={`QR code for ${c.name}`} dangerouslySetInnerHTML={{ __html: c.svg }} />
              <div className={styles.info}>
                <p className={styles.code}><span>{koCards.classCodeLabel}</span> <b>{classCode}</b></p>
                <p className={styles.site}>{siteAddress}</p>
                {koCards.help.map((line) => <p key={line} className={styles.help}>{line}</p>)}
              </div>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
