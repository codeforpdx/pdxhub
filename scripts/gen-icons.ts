import * as lucide from "lucide-react";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const names = [
  "Shield",
  "Flame",
  "CloudLightning",
  "Bus",
  "ArrowUpDown",
  "Construction",
  "Stethoscope",
  "Wrench",
  "Droplets",
] as const;

for (const name of names) {
  const icon = (lucide as Record<string, unknown>)[name];
  if (!icon) {
    console.log(name + ":NOT FOUND");
    continue;
  }
  const svg = renderToStaticMarkup(
    React.createElement(icon as React.ComponentType<Record<string, unknown>>, {
      size: 12,
      color: "white",
      strokeWidth: 2.5,
    }),
  );
  console.log(name + ":" + svg);
}
