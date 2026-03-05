"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

/**
 * Demo component showing toast notifications
 */
export function ToastDemo() {
  const { toast } = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() => {
          toast({
            title: "Success!",
            description: "Your action was completed successfully.",
          });
        }}
      >
        Show Success Toast
      </Button>
      <Button
        variant="destructive"
        onClick={() => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Something went wrong. Please try again.",
          });
        }}
      >
        Show Error Toast
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          toast({
            title: "Scheduled: Catch up",
            description: "Friday, February 10, 2024 at 5:57 PM",
            action: (
              <Button variant="outline" size="sm">
                Undo
              </Button>
            ),
          });
        }}
      >
        Show Toast with Action
      </Button>
    </div>
  );
}
