export type CrowdingLevel = 'low' | 'medium' | 'high';

export interface BusRoute {
  id: string;
  number: string;
  origin: string;
  destination: string;
  currentStop: string;
  eta: string;
  distance: string;
  departureTime: string;
  arrivalTime: string;
  fare: number;
  crowding: CrowdingLevel;
  seats: {
    men: number;
    women: number;
    total: number;
  };
  stops: { name: string; time: string; passed: boolean }[];
}

export interface Landmark {
  id: string;
  name: string;
  description: string;
  image: string;
  coordinates: { lat: number; lng: number };
  guideNumber: string;
  state: string;
  district: string;
  village: string;
}

export const mockBuses: BusRoute[] = [
  {
    id: "b1",
    number: "21G",
    origin: "Broadway",
    destination: "Tambaram",
    currentStop: "Mylapore",
    eta: "5 mins",
    distance: "1.2 km",
    departureTime: "08:00",
    arrivalTime: "09:15",
    fare: 25,
    crowding: 'low',
    seats: { men: 15, women: 10, total: 45 },
    stops: [
      { name: "Broadway", time: "08:00", passed: true },
      { name: "Central", time: "08:15", passed: true },
      { name: "Mylapore", time: "08:30", passed: true },
      { name: "Adyar", time: "08:45", passed: false },
      { name: "Tambaram", time: "09:15", passed: false },
    ],
  },
  {
    id: "b2",
    number: "32B",
    origin: "T. Nagar",
    destination: "Koyambedu",
    currentStop: "Nungambakkam",
    eta: "12 mins",
    distance: "3.5 km",
    departureTime: "09:00",
    arrivalTime: "09:40",
    fare: 15,
    crowding: 'medium',
    seats: { men: 20, women: 20, total: 40 },
    stops: [
      { name: "T. Nagar", time: "09:00", passed: true },
      { name: "Nungambakkam", time: "09:15", passed: true },
      { name: "Koyambedu", time: "09:40", passed: false },
    ],
  },
  {
    id: "b3",
    number: "102",
    origin: "Broadway",
    destination: "Kelambakkam",
    currentStop: "Adyar",
    eta: "8 mins",
    distance: "2.1 km",
    departureTime: "08:30",
    arrivalTime: "10:00",
    fare: 35,
    crowding: 'high',
    seats: { men: 5, women: 5, total: 50 },
    stops: [
      { name: "Broadway", time: "08:30", passed: true },
      { name: "Adyar", time: "09:00", passed: true },
      { name: "Kelambakkam", time: "10:00", passed: false },
    ],
  },
];

export const mockLandmarks: Landmark[] = [
  {
    id: "l1",
    name: "Kapaleeshwarar Temple",
    description: "A 7th-century Hindu temple dedicated to Lord Shiva, located in Mylapore, Chennai.",
    image: "https://picsum.photos/seed/temple/800/600",
    coordinates: { lat: 13.0334, lng: 80.2697 },
    guideNumber: "+91 98400 12345",
    state: "Tamil Nadu",
    district: "Chennai",
    village: "Mylapore",
  },
  {
    id: "l2",
    name: "Rockfort Temple",
    description: "A historic fortification and temple complex built on an ancient rock in Tiruchirappalli.",
    image: "https://picsum.photos/seed/rockfort/800/600",
    coordinates: { lat: 10.8297, lng: 78.6971 },
    guideNumber: "+91 94433 67890",
    state: "Tamil Nadu",
    district: "Tiruchirappalli",
    village: "Trichy Town",
  },
];

export interface Room {
  id: string;
  name: string;
  location: string;
  rent: number;
  rating: number;
  image: string;
  amenities: string[];
}

export const mockRooms: Room[] = [
  {
    id: "r1",
    name: "Mylapore Residency",
    location: "Near Kapaleeshwarar Temple",
    rent: 1200,
    rating: 4.2,
    image: "https://picsum.photos/seed/room1/800/600",
    amenities: ["AC", "WiFi", "Breakfast"],
  },
  {
    id: "r2",
    name: "Adyar Guest House",
    location: "Besant Nagar",
    rent: 850,
    rating: 3.8,
    image: "https://picsum.photos/seed/room2/800/600",
    amenities: ["WiFi", "Laundry"],
  },
  {
    id: "r3",
    name: "Trichy Rockfort Stay",
    location: "Main Guard Gate",
    rent: 1500,
    rating: 4.5,
    image: "https://picsum.photos/seed/room3/800/600",
    amenities: ["AC", "WiFi", "Parking"],
  },
];
