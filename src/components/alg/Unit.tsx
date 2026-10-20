import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { ALGEBRA_STAGES, Card, FlowBar, Misconceptions, ModuleHeader, PrevNext, Stage } from '../Lesson';
import { MODULES, moduleIndex } from '../../lib/modules';
import { ConventionBanner } from '../l2/Common';

export { RelatedLinks, type UnitLink } from './Links';
import { RelatedLinks, type UnitLink } from './Links';

interface Section {
  title: string;
  body: ReactNode;
}

interface UnitProps {
  id: string;
  lead?: ReactNode;
  /** show the MSB-first bit-order banner (units that use bit strings as polynomials) */
  convention?: boolean;
  why: Section;
  what: Section;
  how: Section;
  example: Section;
  connection: {
    title: string;
    body?: ReactNode;
    links: UnitLink[];
    misconceptions: { wrong: ReactNode; right: ReactNode }[];
  };
}

/** Algebra-chapter unit: WHY → WHAT → HOW → EXAMPLE → CONNECTION. */
export function AlgebraUnit({ id, lead, convention = false, why, what, how, example, connection }: UnitProps) {
  const next = MODULES[moduleIndex(id) + 1];
  return (
    <div>
      <ModuleHeader moduleId={id}>{lead}</ModuleHeader>
      {convention && <ConventionBanner />}
      <FlowBar moduleId={id} order={ALGEBRA_STAGES} />
      <div className="space-y-12">
        <Stage kind="why" moduleId={id} title={why.title}>
          {why.body}
        </Stage>
        <Stage kind="what" moduleId={id} title={what.title}>
          {what.body}
        </Stage>
        <Stage kind="how" moduleId={id} title={how.title}>
          {how.body}
        </Stage>
        <Stage kind="example" moduleId={id} title={example.title}>
          {example.body}
        </Stage>
        <Stage kind="connection" moduleId={id} title={connection.title}>
          {connection.body}
          <Misconceptions items={connection.misconceptions} />
          <Card>
            <RelatedLinks links={connection.links} />
            {next && (
              <a href={`#/${next.id}`} className="btn-primary mt-4">
                下一個單元：{next.num} {next.title} <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </Card>
        </Stage>
      </div>
      <PrevNext moduleId={id} />
    </div>
  );
}

/** Plain-language box ("白話解釋") */
export function Plain({ children }: { children: ReactNode }) {
  return <div className="prose-lab">{children}</div>;
}

/** Small 「名詞（English）」 definition list; omit `en` for labels that are not a named concept */
export function Terms({ items }: { items: { zh: string; en?: string; def: ReactNode }[] }) {
  return (
    <Card>
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((t) => (
          <div key={t.zh} className="rounded-xl bg-slate-50 p-3">
            <dt className="text-sm font-bold text-slate-900">
              {t.zh}
              {t.en && <span className="font-normal text-slate-500">（{t.en}）</span>}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-700">{t.def}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
