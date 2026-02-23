package com.speedrweb.repository;

import com.speedrweb.model.AnalysisRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface AnalysisRequestRepository extends JpaRepository<AnalysisRequest, UUID> {

    @Query(value = "SELECT a FROM AnalysisRequest a JOIN FETCH a.video WHERE a.video.user.id = :userId ORDER BY a.createdAt DESC",
           countQuery = "SELECT COUNT(a) FROM AnalysisRequest a WHERE a.video.user.id = :userId")
    Page<AnalysisRequest> findAllByUserId(@Param("userId") UUID userId, Pageable pageable);

    @Query(value = "SELECT a FROM AnalysisRequest a JOIN FETCH a.video ORDER BY a.createdAt DESC",
           countQuery = "SELECT COUNT(a) FROM AnalysisRequest a")
    Page<AnalysisRequest> findAllWithVideo(Pageable pageable);

    long countByVideoUserId(UUID userId);
}
