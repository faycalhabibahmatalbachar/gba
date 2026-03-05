import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormDemo } from "@/components/form-demo";

export default function ContactPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Contact</h1>
        <p className="text-muted-foreground text-lg">
          Get in touch with us using the form below.
        </p>
      </section>

      <section className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Contact Form</CardTitle>
            <CardDescription>
              Fill out the form below and we'll get back to you as soon as
              possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormDemo />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
