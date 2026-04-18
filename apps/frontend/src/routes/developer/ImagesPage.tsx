import { Card } from '@/components/ui/card';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router';

const IMAGES = [
    { id: '1', title: 'Rustic Loaf', url: '/surdej-1.png' },
    { id: '2', title: 'Floured Crust', url: '/surdej-2.png' },
    { id: '3', title: 'Moody Baker', url: '/surdej-3.png' },
    { id: '4', title: 'Cooling Rack', url: '/surdej-4.png' },
    { id: '5', title: 'Dark Crumb', url: '/surdej-5.png' },
    { id: '6', title: 'Bubbling Starter', url: '/surdej-6.png' },
    { id: '7', title: 'Morning Bake', url: '/surdej-7.png' },
    { id: '8', title: 'Artisan Ingredients', url: '/surdej-8.png' },
    { id: '9', title: 'Flour Dust', url: '/surdej-9.png' },
    { id: '10', title: 'Noir Table', url: '/surdej-10.png' }
];

export function ImagesPage() {
    const navigate = useNavigate();

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <Button variant="ghost" onClick={() => navigate('/developer')} className="mb-6 group">
                <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
                Back to Developer Hub
            </Button>

            <div className="mb-8 pl-2">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <ImageIcon className="h-8 w-8 text-primary" />
                    Surdej Image Gallery
                </h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                    A curated collection of &quot;Surdej&quot; (sourdough) images styled with a touch of Nordic Noir. These backgrounds are used for cards, banners, and layout samples.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {IMAGES.map((img) => (
                    <Card key={img.id} className="overflow-hidden group cursor-pointer border-border/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="relative aspect-[4/3] overflow-hidden">
                            {/* Image with dark gradient overlay for that Nordic Noir feel */}
                            <img
                                src={img.url}
                                alt={img.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-90" />
                            <div className="absolute bottom-4 left-4 right-4">
                                <h3 className="font-semibold text-foreground truncate drop-shadow-md">{img.title}</h3>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
