import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-sidebar group-[.toaster]:text-sidebar-foreground group-[.toaster]:border-sidebar-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-sidebar-foreground/80",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-sidebar-accent group-[.toast]:text-sidebar-accent-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
