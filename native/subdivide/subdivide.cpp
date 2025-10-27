#include <vector>
#include <cmath>
#include <cstdlib>
#include <emscripten/emscripten.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

struct Pt { double x; double y; };

static inline double distance(const Pt& a, const Pt& b) {
    const double dx = b.x - a.x;
    const double dy = b.y - a.y;
    return std::sqrt(dx * dx + dy * dy);
}

static inline double turn_angle_deg(const Pt& prev, const Pt& curr, const Pt& next) {
    const double v1x = curr.x - prev.x;
    const double v1y = curr.y - prev.y;
    const double v2x = next.x - curr.x;
    const double v2y = next.y - curr.y;
    const double dot = v1x * v2x + v1y * v2y;
    const double n1 = std::sqrt(v1x * v1x + v1y * v1y);
    const double n2 = std::sqrt(v2x * v2x + v2y * v2y);
    if (n1 == 0.0 || n2 == 0.0) return 0.0;
    double c = dot / (n1 * n2);
    if (c > 1.0) c = 1.0; else if (c < -1.0) c = -1.0;
    return std::acos(c) * 180.0 / M_PI;
}

static std::vector<Pt> subdivide_long_segments(const std::vector<Pt>& in, double maxSegLen) {
    if (in.size() <= 1 || maxSegLen <= 0.0) return in;
    std::vector<Pt> out;
    out.reserve(in.size());
    for (size_t i = 0; i + 1 < in.size(); ++i) {
        const Pt a = in[i];
        const Pt b = in[i + 1];
        out.push_back(a);
        const double len = distance(a, b);
        if (len > maxSegLen) {
            const int splits = (int)std::ceil(len / maxSegLen) - 1; // number of points to insert
            if (splits > 0) {
                const double step = 1.0 / (splits + 1);
                for (int s = 1; s <= splits; ++s) {
                    const double t = step * s;
                    out.push_back({ a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t });
                }
            }
        }
    }
    // push last
    out.push_back(in.back());
    return out;
}

static std::vector<Pt> refine_by_angle(const std::vector<Pt>& in, double angleLimitDeg) {
    if (in.size() <= 2 || angleLimitDeg <= 0.0) return in;
    std::vector<Pt> pts = in;
    // Do a couple of refinement passes to avoid runaway growth
    const int maxPasses = 2;
    for (int pass = 0; pass < maxPasses; ++pass) {
        bool inserted = false;
        std::vector<Pt> out;
        out.reserve(pts.size() * 2);
        out.push_back(pts[0]);
        for (size_t i = 1; i + 1 < pts.size(); ++i) {
            const Pt& prev = pts[i - 1];
            const Pt& curr = pts[i];
            const Pt& next = pts[i + 1];
            const double ang = turn_angle_deg(prev, curr, next);
            out.push_back(curr);
            if (ang > angleLimitDeg) {
                // Insert midpoint on segment (curr->next) to reduce angular change per segment
                const Pt mid{ (curr.x + next.x) * 0.5, (curr.y + next.y) * 0.5 };
                out.push_back(mid);
                inserted = true;
            }
        }
        out.push_back(pts.back());
        pts.swap(out);
        if (!inserted) break;
    }
    return pts;
}

extern "C" {
    // API: returns malloc'ed buffer of [x0,y0,...] doubles; writes outLenPts
    // Caller must free() the returned pointer.
    EMSCRIPTEN_KEEPALIVE
    double* subdivide_path(const double* xy, int nPts, double angleLimitDeg, double maxSegLen, int* outLenPts) {
        if (!xy || nPts <= 0 || !outLenPts) {
            *outLenPts = 0;
            return nullptr;
        }
        std::vector<Pt> pts;
        pts.reserve(static_cast<size_t>(nPts));
        for (int i = 0; i < nPts; ++i) {
            const double x = xy[i * 2 + 0];
            const double y = xy[i * 2 + 1];
            pts.push_back({ x, y });
        }

        std::vector<Pt> step1 = subdivide_long_segments(pts, maxSegLen);
        std::vector<Pt> step2 = refine_by_angle(step1, angleLimitDeg);

        const int outPts = static_cast<int>(step2.size());
        const size_t bytes = static_cast<size_t>(outPts) * 2u * sizeof(double);
        double* out = static_cast<double*>(std::malloc(bytes));
        if (!out) {
            *outLenPts = 0;
            return nullptr;
        }
        for (int i = 0; i < outPts; ++i) {
            out[i * 2 + 0] = step2[i].x;
            out[i * 2 + 1] = step2[i].y;
        }
        *outLenPts = outPts;
        return out;
    }
}


