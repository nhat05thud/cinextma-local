"use client";

import { Accordion, AccordionItem } from "@heroui/react";

/** Accordion của HeroUI dựng collection từ children nên phải render phía client. */
const Faq: React.FC<{ items: { q: string; a: string }[] }> = ({ items }) => (
  <Accordion variant="splitted">
    {items.map((item) => (
      <AccordionItem key={item.q} title={item.q}>
        <p className="text-foreground-600 pb-2 text-sm">{item.a}</p>
      </AccordionItem>
    ))}
  </Accordion>
);

export default Faq;
