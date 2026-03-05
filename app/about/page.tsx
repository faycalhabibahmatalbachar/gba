import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold tracking-tight mb-4">About</h1>
        <p className="text-muted-foreground text-lg">
          Learn more about this Next.js application.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Built with Next.js</CardTitle>
            <CardDescription>App Router architecture</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This application uses Next.js 14 with the App Router for optimal
              performance and developer experience.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>shadcn/ui Components</CardTitle>
            <CardDescription>Accessible and customizable</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              All UI components are built with shadcn/ui, providing
              accessibility and customization out of the box.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Image Optimization</CardTitle>
            <CardDescription>Using next/image</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full h-64 rounded-lg overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop"
                alt="Example image"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority={false}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Images are automatically optimized by Next.js for better
              performance.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
