// customized: Fleet Deck action hierarchy, focus treatment, and touch targets.
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-4 text-base font-semibold whitespace-nowrap transition-[color,background-color,border-color,transform] active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-50 disabled:grayscale aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-action-primary text-surface hover:bg-action-primary-hover active:bg-action-primary-pressed",
        secondary: "border-2 border-action-primary bg-surface text-action-primary hover:bg-info active:bg-selected-bg",
        tertiary: "bg-transparent text-link underline-offset-4 hover:underline active:decoration-2",
        link: "bg-transparent text-link underline underline-offset-4 hover:decoration-2 active:decoration-[3px]",
        dialogDestructive: "bg-destructive text-surface hover:bg-[var(--destructive-hover)] active:bg-[var(--destructive-pressed)]",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-11 px-3",
        lg: "h-12 px-6",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

function Button({ className, variant = "primary", size = "default", asChild = false, type, disabled, onClickCapture, tabIndex, ...props }:
  React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  const isDisabled = disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true";
  return <Comp {...props} data-slot="button" data-variant={variant} data-size={size}
    aria-disabled={isDisabled || undefined}
    className={cn(buttonVariants({ variant, size, className }))}
    disabled={asChild ? undefined : disabled}
    onClickCapture={(event: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onClickCapture?.(event);
    }}
    tabIndex={asChild && isDisabled ? -1 : tabIndex}
    type={asChild ? undefined : (type ?? "button")} />;
}

export { Button, buttonVariants };
