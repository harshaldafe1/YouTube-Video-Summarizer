/**
 * Video document schema.
 * One document per unique YouTube URL.
 */

import mongoose from 'mongoose';

const summarySchema = new mongoose.Schema({
    title: {
        type: String,
        default: ''
    },
    overview: {
        type: String,
        default: ''
    },
    keyPoints: {
        type: [String],
        default: []
    },
    takeaways: {
        type: [String],
        default: []
    },
}, {
    _id: false
});

const videoSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        trim: true,
    },
    videoId: {
        type: String,
        required: true,
        trim: true,
    },
    title: {
        type: String,
        default: '',
    },
    transcript: {
        type: String,
        default: '',
    },
    chunks: {
        type: [String],
        default: [],
    },
    chunkSummaries: {
        type: [String],
        default: [],
    },
    summary: {
        type: summarySchema,
        default: () => ({}),
    },
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing',
    },
    errorMessage: {
        type: String,
        default: null,
    },
    jobId: {
        type: String,
        default: null,
    },
}, {
    timestamps: true, // adds createdAt + updatedAt
});

// Index already enforced by unique:true on url,
// but an explicit named index makes Atlas UI clearer.
videoSchema.index({
    url: 1
}, {
    unique: true
});
videoSchema.index({
    jobId: 1
});

const Video = mongoose.model('Video', videoSchema);
export default Video;