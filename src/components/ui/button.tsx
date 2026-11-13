"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "./button-variants";

import { cn } from "@/lib/utils";

function Button({
  className,
  variant = "default",
  size = "default",
  mobileTouch = false,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, mobileTouch, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
