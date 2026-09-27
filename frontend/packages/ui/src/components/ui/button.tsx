import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center cursor-pointer justify-center rounded-3xl border border-transparent bg-clip-padding text-sm font-sans font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-primary focus-visible:ring-0 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border hover:bg-input/20 hover:text-foreground aria-expanded:bg-input aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted text-primary aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        "ghost-primary":
          "hover:bg-primary/10 text-primary aria-expanded:bg-primary/10 aria-expanded:text-foreground dark:hover:bg-primary/10",
        destructive:
          "text-white border border-destructive bg-destructive hover:bg-destructive/90 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        success:
          "bg-green-600 text-white hover:bg-green-600/90 dark:bg-green-600 dark:hover:bg-green-600/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "sm:h-9 h-7 gap-1.5 py-2 px-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 w-full sm:w-auto",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3 w-full sm:w-auto",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5 w-full sm:w-auto",
        lg: "h-9 sm:h-11 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 w-full sm:w-auto",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-xl [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-xl",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  isLoading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    isLoading?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled || isLoading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : isLoading ? (
        <>
          <Spinner />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
