import Link from 'next/link';
import { waLink } from '@/lib/config';
import { pageMeta } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';

export const metadata = pageMeta({ title: 'Size guide', description: 'How to measure yourself and choose the right size for clothes and shoes when you shop online in Pakistan.', path: '/size-guide' });

const SHOES = [['38', '24.0'], ['39', '24.6'], ['40', '25.3'], ['41', '26.0'], ['42', '26.7'], ['43', '27.3'], ['44', '28.0'], ['45', '28.7']];

export default function SizeGuide() {
  return (
    <>
      <PageHead title="Size guide" intro="A few minutes with a tape measure saves you a return." crumbs={[['/', 'Home'], [null, 'Size guide']]} />
      <Prose>
        <p>Brands and makers use different size charts, so <b>the size chart on the product page always comes first</b>. This page shows how to measure and gives rough numbers to help you decide.</p>
        <h2>Clothes: measure a shirt you already like</h2>
        <p>Lay a shirt that fits you well flat on a bed. Measure and write down:</p>
        <ul>
          <li><b>Chest:</b> straight across under the arms, then double it</li>
          <li><b>Length:</b> from the top of the shoulder to the hem</li>
          <li><b>Sleeve:</b> from the shoulder seam to the cuff</li>
        </ul>
        <p>Compare these numbers with the chart on the product page, not only the letter (S, M, L). For winter wear, leave extra room for the layers you will wear underneath.</p>
        <h2>Shoes: measure your foot</h2>
        <p>Stand on a sheet of paper, mark the tip of your longest toe and the back of your heel, and measure the distance in centimetres. Measure in the evening, when feet are largest. Add about 0.5 cm for comfort.</p>
        <div className="overflow-x-auto"><table>
          <thead><tr><th>Shoe size (EU)</th><th>Foot length (cm), about</th></tr></thead>
          <tbody>{SHOES.map(([s, c]) => <tr key={s}><td>{s}</td><td>{c}</td></tr>)}</tbody>
        </table></div>
        <p>These are rough values; boots and sports shoes can fit differently. If you are between two sizes, choose the bigger one.</p>
        <h2>Still unsure?</h2>
        <p>Send us your measurements on <a href={waLink('Assalam o Alaikum, please help me choose a size. Product: ')} target="_blank" rel="noopener noreferrer">WhatsApp</a> and we will help. Read also <Link href="/blog/how-to-choose-the-right-size-online">how to choose the right size online</Link> and our <Link href="/returns">returns page</Link>.</p>
      </Prose>
    </>
  );
}
