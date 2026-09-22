export type SceneType = 'outdoor' | 'indoor'
export type PublishStatus = 'draft' | 'pending' | 'published'
export interface Coordinate { latitude: number; longitude: number }
export interface Narration { id: string; guideId: string; guideName: string; guideStyle: string; title: string; durationSeconds: number; script: string; audioUrl: string | null; status: PublishStatus }
export interface CulturalPlace extends Coordinate { id: string; destinationId: string; code: string; name: string; category: string; address: string; recommendedMinutes: number; description: string; status: PublishStatus; narrations: Narration[] }
export interface IndoorSpace { id: string; destinationId: string; name: string; kind: 'floor' | 'gallery' | 'facility'; parentId: string | null; description: string }
export interface Destination extends Coordinate { id: string; code: string; name: string; sceneType: SceneType; address: string; openingHours: string; status: 'enabled' | 'disabled'; mapProvider: 'OpenStreetMap' | 'Tencent'; coordinateSystem: 'WGS84' | 'GCJ02'; boundaryGeoJson: string | null; intro: string; placeIds: string[]; indoorSpaceIds: string[] }
export interface RouteStop { id: string; placeId: string; arrivalNote: string; transportMode: 'rickshaw' | 'walk' | 'indoor'; stayMinutes: number }
export interface TourRoute { id: string; destinationId: string; code: string; name: string; sceneType: SceneType; theme: string; distanceKm: number; estimatedMinutes: number; status: PublishStatus; auditRemark: string; ownerName: string; stops: RouteStop[]; geometry: Coordinate[] }
export interface DemoDatabase { destinations: Destination[]; places: CulturalPlace[]; indoorSpaces: IndoorSpace[]; routes: TourRoute[] }
