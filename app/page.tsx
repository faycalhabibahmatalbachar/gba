import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { ToastDemo } from "@/components/toast-demo";
import { FormDemo } from "@/components/form-demo";
import { TableDemo } from "@/components/table-demo";
import { DialogDemo } from "@/components/dialog-demo";

export default function Home() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Next.js + shadcn/ui
        </h1>
        <p className="text-muted-foreground text-lg">
          Production-ready components with TypeScript, Tailwind CSS, and accessibility in mind.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Button Variants</CardTitle>
            <CardDescription>Different button styles and sizes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">🚀</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
            <CardDescription>User avatars with fallback</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4 items-center">
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>{getInitials("John Doe")}</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Toast Notifications</CardTitle>
            <CardDescription>Toast demo component</CardDescription>
          </CardHeader>
          <CardContent>
            <ToastDemo />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Form with Validation</CardTitle>
            <CardDescription>React Hook Form + Zod validation</CardDescription>
          </CardHeader>
          <CardContent>
            <FormDemo />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Data Table</CardTitle>
            <CardDescription>Accessible paginated table</CardDescription>
          </CardHeader>
          <CardContent>
            <TableDemo />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Modal Dialog</CardTitle>
            <CardDescription>Accessible dialog component</CardDescription>
          </CardHeader>
          <CardContent>
            <DialogDemo />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
