import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "h1",
            "title",
            "h2",
            "h3",
            "body-lg",
            "body",
            "small",
            "label",
            "value",
            "code",
          ],
        },
      ],
    },
  },
});

/** Join class names and let later Tailwind utilities win over earlier ones. */
export const cn = (...inputs: ClassValue[]): string => {
  return merge(clsx(inputs));
};
