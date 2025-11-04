import { EventCategory, Event } from '../types';
import { db } from './db';

/**
 * Handles a request for AI event recommendations.
 * @param {Request} req - Contains user interests and attended events in the body.
 * @returns {Response} A list of recommended event IDs.
 */
export async function handleGetAIRecommendations(req: { body: { interests: EventCategory[], attendedEvents: string[] } }) {
    const { interests, attendedEvents } = req.body;
    const allEvents = db.events.findAll();

    try {
        const availableEvents = allEvents
            .filter(event => new Date(event.date) > new Date() && !attendedEvents.includes(event.id))
            .map(event => ({
                id: event.id,
                title: event.title,
                description: event.description,
                category: event.category,
                date: event.date
            }));

        if (availableEvents.length === 0) {
            return new Response(JSON.stringify([]), { status: 200 });
        }

        const recommendations = scoreEvents({
            availableEvents,
            interests
        }).slice(0, 3);

        return new Response(JSON.stringify(recommendations), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Backend error fetching AI recommendations:", error);
        return new Response(JSON.stringify({ message: 'Failed to get AI recommendations' }), { status: 500 });
    }
}

interface ScoreInput {
    availableEvents: Pick<Event, 'id' | 'title' | 'description' | 'category' | 'date'>[];
    interests: EventCategory[];
}

function scoreEvents({ availableEvents, interests }: ScoreInput): string[] {
    const interestSet = new Set(interests);

    return availableEvents
        .map(event => {
            let score = 0;

            if (interestSet.has(event.category)) {
                score += 5;
            }

            const daysUntil = getDaysUntil(event.date);
            if (daysUntil <= 3) {
                score += 3;
            } else if (daysUntil <= 7) {
                score += 2;
            } else if (daysUntil <= 30) {
                score += 1;
            }

            if (event.description.toLowerCase().includes('featured')) {
                score += 1;
            }

            return { id: event.id, score, date: event.date };
        })
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        })
        .map(item => item.id);
}

function getDaysUntil(date: string): number {
    const eventDate = new Date(date).getTime();
    const now = Date.now();
    const diffMs = eventDate - now;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
