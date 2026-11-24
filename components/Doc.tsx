import type { ReactNode } from "react";

/** Simple readable typography for the manual and FAQ pages. */
export default function Doc({ children }: { children: ReactNode }) {
  return (
    <article
      className="max-w-3xl leading-relaxed [&_h1]:text-3xl [&_h1]:font-extralight [&_h1]:tracking-widest [&_h1]:mb-6
        [&_h2]:text-xl [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-[var(--accent)] [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
        [&_li]:my-1 [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:rounded [&_a]:underline [&_dt]:font-medium [&_dt]:mt-4 [&_dd]:opacity-80"
    >
      {children}
    </article>
  );
}
